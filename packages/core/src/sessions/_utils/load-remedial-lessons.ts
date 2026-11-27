import "server-only";
import { prisma } from "@zoonk/db";
import { evaluateUsage } from "../../entitlements/_utils/evaluate-usage";
import { countUsage } from "../../entitlements/_utils/usage-counts";
import { getEstimatedCostMicros } from "../../entitlements/limits";
import { type FollowUp } from "../../follow-ups/follow-up-contract";
import { type readSkillMistakeSignals } from "../../learner/read-skill-mistake-signals";
import { type SkillMistakeSignal } from "../../learner/skill-mistake-signal";
import { NOT_A_CAPSULE } from "../../lesson-player/_utils/lesson-runs";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { isQuickLessonIdentityKey } from "../../library/quick-lessons/quick-lesson-identity";
import {
  getSecondTakeIdentityKey,
  isSecondTakeIdentityKey,
} from "../../library/second-takes/second-take-identity";
import { toMinutes } from "../block-minutes";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { type loadDayPlan } from "./day-plan";
import { type SessionDayContext } from "./session-placement";

type Signals = Awaited<ReturnType<typeof readSkillMistakeSignals>>;
type DayPlan = Awaited<ReturnType<typeof loadDayPlan>>;
type RemedialFollowUp = Extract<FollowUp, { kind: "writeLesson" | "writeSecondTake" }>;

function isTeachingDue(signal: SkillMistakeSignal) {
  return signal.stuck && (signal.stage === "none" || signal.dueSecondTake);
}

function loadTeachingMaterial({ signals, userId }: { signals: Signals; userId: string }) {
  const due = [...signals].filter(([, signal]) => isTeachingDue(signal));
  const stepIds = due.flatMap(([, signal]) => signal.latestMiss?.stepId ?? []);
  const itemIds = due.flatMap(([, signal]) => signal.latestMiss?.itemId ?? []);
  const skillIds = due.map(([skillId]) => skillId);

  const stepWhere = {
    OR: [{ id: { in: stepIds } }, { ...CURRENT_STEPS, itemId: { in: itemIds } }],
  };

  return prisma.lesson.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      _count: { select: { steps: { where: CURRENT_STEPS } } },
      canDo: true,
      contentStatus: true,
      estimatedMinutes: true,
      id: true,
      identityKey: true,
      setAsideAt: true,
      skills: { select: { skillId: true } },
      steps: { select: { id: true, itemId: true }, where: stepWhere },
      title: true,
    },
    where: {
      ...libraryRowsVisibleTo(userId),
      AND: [
        {
          OR: [{ skills: { some: { skillId: { in: skillIds } } } }, { steps: { some: stepWhere } }],
        },
      ],
    },
  });
}

type TeachingLesson = Awaited<ReturnType<typeof loadTeachingMaterial>>[number];

function toTeachingBlock(
  lesson: TeachingLesson,
  returning: "again" | "anotherWay" | "missed",
): PlannedBlock {
  return {
    canDo: lesson.canDo,
    estimatedMinutes: toMinutes(lesson.estimatedMinutes),
    kind: "learn",
    lessonId: lesson.id,
    payload: toBlockPayload({
      returning,
      skillIds: lesson.skills.map(({ skillId }) => skillId),
      title: lesson.title,
    }),
  };
}

async function loadLessonStarts({
  lessonIds,
  now,
  tier,
  userId,
}: Pick<SessionDayContext, "now" | "userId"> & { lessonIds: string[]; tier: DayPlan["tier"] }) {
  const [count, claimed] = await Promise.all([
    countUsage({ client: prisma, kind: "lessonStart", now, userId }),
    prisma.usageRecord.findMany({
      select: { countedAt: true, targetId: true },
      where: { kind: "lessonStart", targetId: { in: lessonIds }, userId },
    }),
  ]);

  const allowed =
    evaluateUsage({
      costMicros: getEstimatedCostMicros({ generated: false, kind: "lessonStart" }),
      counts: count,
      generated: false,
      kind: "lessonStart",
      now,
      tier,
    }).status === "allowed";

  return (lessonId: string) =>
    allowed ||
    claimed.some((row) => row.targetId === lessonId && (row.countedAt || tier !== "free"));
}

export type TeachingCandidate = { block: PlannedBlock; missedAt: number; weight: number };

export async function loadTeaching({
  context,
  signals,
  tier,
  weights,
}: {
  context: SessionDayContext;
  signals: Signals;
  tier: DayPlan["tier"];
  weights: ReadonlyMap<string, number>;
}): Promise<{ followUps: RemedialFollowUp[]; teaching: TeachingCandidate[] }> {
  const { now, userId } = context;

  const ranked = [...signals].filter(([, signal]) => isTeachingDue(signal));

  if (ranked.length === 0) {
    return { followUps: [], teaching: [] };
  }

  const [lessons, skills] = await Promise.all([
    loadTeachingMaterial({ signals, userId }),
    prisma.skill.findMany({
      select: { id: true, ownerId: true, visibility: true },
      where: { ...libraryRowsVisibleTo(userId), id: { in: ranked.map(([id]) => id) } },
    }),
  ]);

  const ownerBySkill = new Map(
    skills.map(({ id, ownerId, visibility }) => [id, visibility === "private" ? ownerId : null]),
  );

  const completed = await prisma.learningEvent.findMany({
    select: { contentIds: true },
    where: {
      AND: [
        NOT_A_CAPSULE,
        { OR: lessons.map(({ id }) => ({ contentIds: { equals: id, path: ["lessonId"] } })) },
      ],
      endedAt: { lte: now },
      kind: { in: ["lesson", "review"] },
      userId,
    },
  });

  const finished = new Set(
    completed.flatMap(({ contentIds }) =>
      contentIds &&
      typeof contentIds === "object" &&
      "lessonId" in contentIds &&
      typeof contentIds.lessonId === "string"
        ? [contentIds.lessonId]
        : [],
    ),
  );

  const startable =
    lessons.length > 0
      ? await loadLessonStarts({ lessonIds: lessons.map(({ id }) => id), now, tier, userId })
      : () => false;

  const choices = ranked.flatMap(([skillId, signal]) => {
    const ownerId = ownerBySkill.get(skillId);

    if (ownerId === undefined) {
      return [];
    }

    return [
      {
        ...chooseRemedialLesson({ finished, lessons, ownerId, signal, skillId, startable, userId }),
        missedAt: signal.latestMiss?.answeredAt.getTime() ?? 0,
        weight: weights.get(skillId) ?? 0,
      },
    ];
  });

  return {
    followUps: choices.flatMap(({ followUp }) => followUp ?? []),
    teaching: choices.flatMap(({ block, missedAt, weight }) =>
      block ? [{ block, missedAt, weight }] : [],
    ),
  };
}

function isWritten(lesson: TeachingLesson | undefined): lesson is TeachingLesson {
  return lesson?.contentStatus === "completed" && !lesson.setAsideAt && lesson._count.steps > 0;
}

function needsSecondTakeWriting(lesson: TeachingLesson | undefined) {
  return (
    !lesson ||
    (!lesson.setAsideAt &&
      (lesson.contentStatus === "pending" || lesson.contentStatus === "failed"))
  );
}

function chooseRemedialLesson({
  finished,
  lessons,
  ownerId,
  signal,
  skillId,
  startable,
  userId,
}: {
  finished: ReadonlySet<string>;
  lessons: readonly TeachingLesson[];
  ownerId: string | null;
  signal: SkillMistakeSignal;
  skillId: string;
  startable: (lessonId: string) => boolean;
  userId: string;
}): { block?: PlannedBlock; followUp?: RemedialFollowUp } {
  const forSkill = lessons.filter((lesson) =>
    lesson.skills.some((link) => link.skillId === skillId),
  );

  const ordinary = forSkill.filter(
    (lesson) => !lesson.setAsideAt && !isSecondTakeIdentityKey(lesson.identityKey),
  );

  if (signal.dueSecondTake) {
    const alternatives = ordinary.filter(
      (lesson) => !isQuickLessonIdentityKey(lesson.identityKey) && !finished.has(lesson.id),
    );

    const identity = getSecondTakeIdentityKey({ ownerId, skillId });
    const retake = forSkill.find((lesson) => lesson.identityKey === identity);
    const chosen = alternatives.find((lesson) => lesson.contentStatus === "completed") ?? retake;

    if (isWritten(chosen) && startable(chosen.id)) {
      return { block: toTeachingBlock(chosen, "anotherWay") };
    }

    return alternatives.length === 0 && needsSecondTakeWriting(retake)
      ? { followUp: { input: { skillId, userId }, kind: "writeSecondTake" } }
      : {};
  }

  const origin = findOriginLesson({ latestMiss: signal.latestMiss, lessons });
  const quick = forSkill.find((lesson) => isQuickLessonIdentityKey(lesson.identityKey));

  const chosen =
    origin ??
    ordinary.find((lesson) => finished.has(lesson.id) && lesson.contentStatus === "completed") ??
    (isWritten(quick) ? quick : undefined);

  if (chosen && (finished.has(chosen.id) || startable(chosen.id))) {
    return { block: toTeachingBlock(chosen, finished.has(chosen.id) ? "again" : "missed") };
  }

  const needsQuickLesson = quick
    ? !quick.setAsideAt && quick.contentStatus === "pending"
    : ordinary.length === 0;

  return !chosen && needsQuickLesson
    ? { followUp: { input: { quickSkillId: skillId }, kind: "writeLesson" } }
    : {};
}

function findOriginLesson({
  lessons,
  latestMiss,
}: {
  lessons: readonly TeachingLesson[];
  latestMiss: SkillMistakeSignal["latestMiss"];
}) {
  if (!latestMiss) {
    return;
  }

  const eligible = lessons.filter(
    (lesson) =>
      !lesson.setAsideAt &&
      lesson.contentStatus === "completed" &&
      !isSecondTakeIdentityKey(lesson.identityKey),
  );

  return (
    eligible.find((lesson) => lesson.steps.some((step) => step.id === latestMiss.stepId)) ??
    eligible.find((lesson) =>
      lesson.steps.some((step) => step.itemId && step.itemId === latestMiss.itemId),
    )
  );
}
