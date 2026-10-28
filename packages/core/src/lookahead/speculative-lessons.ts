import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  DEFAULT_START_POSITION,
  type OwnLevel,
  START_POSITIONS,
} from "../learner/placement/placement-steps";
import { planGoalForPick } from "../plans/refresh-goal-plan";
import { isPlacementAhead } from "../view-models/onboarding/onboarding-steps";
import {
  type PlanGenerationManifest,
  readCurrentGenerationTargets,
  readGenerationManifest,
} from "./_utils/generation-manifest";

export type { PlanGenerationManifest } from "./_utils/generation-manifest";

type PlannedLesson = { lessonId: string; phase: number };

type PlanLesson = { lessonId: string | null; phase: number };

async function loadPlanLessons(goalId: string): Promise<PlanLesson[]> {
  const { plan, status } = await planGoalForPick(goalId);

  if (status === "notFound" || status === "paused") {
    return [];
  }

  if (plan) {
    return plan.built.items.flatMap((item) =>
      item.kind === "lesson" && item.status === "todo"
        ? [{ lessonId: item.lessonId, phase: item.phase }]
        : [],
    );
  }

  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true, phase: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });
}

/** Do not speculate on private lessons before placement: a skipped lesson would be paid for and never reused. */
async function toWritableLessons({
  goalId,
  lessons,
}: {
  goalId: string;
  lessons: readonly PlanLesson[];
}) {
  const [goal, stored] = await Promise.all([
    prisma.goal.findUnique({ select: { details: true }, where: { id: goalId } }),
    prisma.lesson.findMany({
      select: { contentStatus: true, id: true, visibility: true },
      where: {
        id: { in: lessons.flatMap((lesson) => (lesson.lessonId ? [lesson.lessonId] : [])) },
        setAsideAt: null,
      },
    }),
  ]);

  const placementAhead = isPlacementAhead(isJsonObject(goal?.details) ? goal.details : {});
  const byId = new Map(stored.map((lesson) => [lesson.id, lesson]));

  return lessons.flatMap(({ lessonId, phase }) => {
    const lesson = lessonId ? byId.get(lessonId) : undefined;

    return lessonId && lesson && !(placementAhead && lesson.visibility === "private")
      ? [{ lessonId, phase, status: lesson.contentStatus }]
      : [];
  });
}

function pickLikelyStartPhases({
  lessons,
  ownLevel,
}: {
  lessons: readonly PlannedLesson[];
  ownLevel: OwnLevel | null;
}): number[] {
  const phases = [...new Set(lessons.map((lesson) => lesson.phase))];
  const [first] = phases;

  if (first === undefined) {
    return [];
  }

  if (ownLevel === "none") {
    return [first];
  }

  const position = ownLevel ? START_POSITIONS[ownLevel] : DEFAULT_START_POSITION;
  const pointed = lessons[Math.round(position * (lessons.length - 1))]?.phase ?? first;
  const second = pointed === first ? phases[1] : pointed;

  return second === undefined ? [first] : [first, second];
}

/** Workflow bridge: authorize goalId first; returns plan-ordered lists per likely start, totaling at most count. */
export async function pickSpeculativeLessons({
  count,
  goalId,
  ownLevel,
}: {
  count: number;
  goalId: string;
  ownLevel: OwnLevel | null;
}): Promise<string[][]> {
  const lessons = await toWritableLessons({ goalId, lessons: await loadPlanLessons(goalId) });
  const phases = pickLikelyStartPhases({ lessons, ownLevel });
  const perPhase = Math.ceil(count / Math.max(phases.length, 1));

  const guesses = phases.map((phase) =>
    lessons
      .filter((lesson) => lesson.phase === phase && lesson.status !== "completed")
      .slice(0, perPhase)
      .map((lesson) => lesson.lessonId),
  );

  return guesses.filter((guess) => guess.length > 0);
}

/** Workflow bridge: authorize goalId first; null when private content must await placement or no first lesson needs writing. */
export async function pickPlanStartToWrite(goalId: string): Promise<string | null> {
  const lessons = await loadPlanLessons(goalId);
  const [first] = lessons;
  const writable = await toWritableLessons({ goalId, lessons });

  return writable.some((lesson) => lesson.lessonId === first?.lessonId)
    ? (first?.lessonId ?? null)
    : null;
}

/** Workflow bridge: authorize goalId first; save the admitted batch as the durable step result before starting children. */
export async function createPlanGenerationManifest({
  goalId,
  lessonIds,
}: {
  goalId: string;
  lessonIds: readonly string[];
}): Promise<PlanGenerationManifest | null> {
  return readGenerationManifest({ goalId, lessonIds });
}

/** A changed epoch revalidates saved membership without running the planner. */
export async function admitPlanLessons({
  goalId,
  lessonIds,
  manifest,
}: {
  goalId: string;
  lessonIds: readonly string[];
  manifest: PlanGenerationManifest | null;
}): Promise<string[]> {
  if (!manifest || manifest.goalId !== goalId) {
    return [];
  }

  const admitted = await readCurrentGenerationTargets({ lessonIds, manifest });
  const current = new Set(admitted);
  const allowed = new Set(manifest.targets.map((target) => target.lessonId));

  const changed = lessonIds.filter((lessonId) => !current.has(lessonId) && allowed.has(lessonId));

  if (changed.length === 0) {
    return admitted;
  }

  const refreshed = await readGenerationManifest({ goalId, lessonIds: changed });

  const selected = new Set([
    ...admitted,
    ...(refreshed?.targets.map((target) => target.lessonId) ?? []),
  ]);

  return lessonIds.filter((lessonId) => selected.has(lessonId));
}
