import "server-only";
import { prisma } from "@zoonk/db";
import { findFreshMistakePatternWithDrill } from "../../language/patterns/find-fresh-pattern";
import { PATTERN_DRILL_SECONDS } from "../../language/patterns/pattern-contract";
import { readSkillMistakeSignals } from "../../learner/read-skill-mistake-signals";
import { MINUTES_PER_REVIEW } from "../../learner/review-load";
import { readyMistakeWhere } from "../../mistakes/mistake-availability";
import { type MistakeReplay, loadMistakeReplays } from "../../mistakes/mistake-replay";
import { PRACTICE_MINUTES_PER_QUESTION } from "../block-minutes";
import { toBlockPayload } from "../block-payload";
import { type loadDayPlan } from "./day-plan";
import { type TeachingCandidate, loadTeaching } from "./load-remedial-lessons";
import { type RemedialWork } from "./remedial-blocks";
import { type SessionDayContext } from "./session-placement";

type DayPlan = Awaited<ReturnType<typeof loadDayPlan>>;
type Signals = Awaited<ReturnType<typeof readSkillMistakeSignals>>;

function getReplayMinutes(replay: MistakeReplay): number {
  const format = replay.kind === "item" ? replay.item.format : replay.lesson.step.kind;

  if (format === "typed" || format === "spokenAnswer" || format === "typedAnswer") {
    return 2;
  }

  return format === "numeric" ? PRACTICE_MINUTES_PER_QUESTION : MINUTES_PER_REVIEW;
}

async function loadReadyMistakes({
  context,
  signals,
  weights,
}: {
  context: SessionDayContext;
  signals: Signals;
  weights: ReadonlyMap<string, number>;
}): Promise<RemedialWork["mistakes"]> {
  const { userId } = context;

  const rows = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { ...readyMistakeWhere(context), skillId: { in: [...signals.keys()] }, userId },
  });

  if (rows.length === 0) {
    return [];
  }

  const replays = await loadMistakeReplays({ mistakes: rows, userId });
  const stuck = (id: string | null) => Number(Boolean(id && signals.get(id)?.stuck));
  const weight = (id: string | null) => (id ? (weights.get(id) ?? 0) : 0);

  return rows
    .toSorted(
      (a, b) => stuck(b.skillId) - stuck(a.skillId) || weight(b.skillId) - weight(a.skillId),
    )
    .flatMap(({ id, skillId }) => {
      const replay = replays.get(id);
      return replay ? [{ id, minutes: getReplayMinutes(replay), skillId }] : [];
    });
}

async function loadPattern({ goal, now, userId }: SessionDayContext): Promise<TeachingCandidate[]> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return [];
  }

  const pattern = await findFreshMistakePatternWithDrill({
    goalId: goal.id,
    language: goal.targetLanguage,
    now,
    userId,
  });

  if (!pattern) {
    return [];
  }

  const latest = await prisma.mistake.findFirst({
    orderBy: { missedAt: "desc" },
    select: { missedAt: true },
    where: { id: { in: pattern.mistakeIds }, userId },
  });

  return [
    {
      block: {
        canDo: null,
        estimatedMinutes: PATTERN_DRILL_SECONDS / 60,
        kind: "practice",
        lessonId: null,
        payload: toBlockPayload({ patternId: pattern.id, title: pattern.title }),
      },
      missedAt: (latest?.missedAt ?? pattern.createdAt).getTime(),
      weight: 0,
    },
  ];
}

export async function loadDayRemediation({
  context,
  plan,
}: {
  context: SessionDayContext;
  plan: DayPlan;
}): Promise<RemedialWork> {
  const { goal, now, userId } = context;
  const weights = new Map<string, number>();

  const graphWeights = new Map(
    plan.graph.skills.map(({ skillId, weight }) => [skillId, weight ?? 0]),
  );

  for (const skill of plan.skills) {
    for (const id of [skill.id, ...skill.memberSkillIds]) {
      const weight =
        goal.kind === "exam" ? (graphWeights.get(id) ?? graphWeights.get(skill.id) ?? 0) : 0;

      weights.set(id, Math.max(weights.get(id) ?? 0, weight));
    }
  }

  const signals = await readSkillMistakeSignals({ now, skillIds: [...weights.keys()], userId });

  const [mistakes, { followUps, teaching }, pattern] = await Promise.all([
    loadReadyMistakes({ context, signals, weights }),
    loadTeaching({ context, signals, tier: plan.tier, weights }),
    loadPattern(context),
  ]);

  return {
    dated: goal.targetDate !== null,
    followUps,
    mistakes,
    teaching: [...teaching, ...pattern]
      .toSorted(
        (a, b) =>
          b.weight - a.weight ||
          b.missedAt - a.missedAt ||
          (a.block.lessonId ?? "").localeCompare(b.block.lessonId ?? ""),
      )
      .map(({ block }) => block),
  };
}
