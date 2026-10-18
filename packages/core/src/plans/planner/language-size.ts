import { type GoalKind } from "@zoonk/db";
import { type CefrLevel, MAX_CEFR_SCORE, parseCefrScore, toCefrLevel } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph } from "./plan-state";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";

const MINUTES_PER_HOUR = 60;

/**
 * Guided learning hours from zero to each CEFR level, A1 first: the middle of Cambridge English's
 * guidance (A2 180–200, B1 350–400, B2 500–600, C1 700–800, C2 1,000–1,200 hours; "Guided
 * learning hours", support.cambridgeenglish.org), with A1, which it doesn't list, at half of A2.
 * Each level takes about 200 more hours than the one before, more as they go up.
 */
const GUIDED_HOURS: Readonly<Record<CefrLevel, number>> = {
  A1: 95,
  A2: 190,
  B1: 375,
  B2: 550,
  C1: 750,
  C2: 1100,
};

/**
 * The level a learner gave in onboarding, before the level test replaces it with a CEFR level: the
 * lowest CEFR level of each step (see `CEFR_OWN_LEVELS`), or zero hours for "none".
 */
const OWN_LEVEL_HOURS: Readonly<Record<string, number>> = {
  advanced: GUIDED_HOURS.C1,
  basic: GUIDED_HOURS.A2,
  intermediate: GUIDED_HOURS.B1,
  none: 0,
};

/** Hours from zero to a level on the half-step scale: "B1+" is halfway from B1 to B2. */
function getCefrHours(score: number): number {
  const level = Math.floor(score);
  const below = GUIDED_HOURS[toCefrLevel(level)];
  const above = level + 1 <= MAX_CEFR_SCORE ? GUIDED_HOURS[toCefrLevel(level + 1)] : below;

  return below + (above - below) * (score - level);
}

function getStartHours(level: unknown): number | null {
  const score = parseCefrScore(level);

  if (score !== null) {
    return getCefrHours(score);
  }

  return typeof level === "string" ? (OWN_LEVEL_HOURS[level] ?? null) : null;
}

/**
 * The lessons a language plan holds to take the learner from their level (a CEFR level from the
 * level test, or the step they gave in onboarding) to the CEFR level they aim for: the guided
 * learning hours between the two, of which the plan gives new lessons its learning share, the rest
 * going to the reviews and practice around them. Null without both levels, or when the learner is
 * already at the level they aim for.
 */
function getLanguageLessonTarget({ from, to }: { from: unknown; to: unknown }): number | null {
  const start = getStartHours(from);
  const target = parseCefrScore(to);

  if (start === null || target === null || getCefrHours(target) <= start) {
    return null;
  }

  const lessonShare = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });
  const lessonMinutes = (getCefrHours(target) - start) * MINUTES_PER_HOUR * lessonShare;

  return Math.round(lessonMinutes / DEFAULT_LESSON_MINUTES);
}

/** Shares `total` among `sizes` in proportion (largest remainder, ties to the earlier), at least 1 each. */
function scaleSizes({ sizes, total }: { sizes: readonly number[]; total: number }): number[] {
  const sum = sizes.reduce((acc, size) => acc + size, 0);
  const exact = sizes.map((size) => (sum > 0 ? (total * size) / sum : total / sizes.length));
  const whole = exact.map((share) => Math.floor(share));
  const left = total - whole.reduce((acc, count) => acc + count, 0);

  const extra = new Set(
    exact
      .map((share, index) => ({ index, remainder: share - (whole[index] ?? 0) }))
      .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, left)
      .map((entry) => entry.index),
  );

  return whole.map((count, index) => Math.max(1, count + (extra.has(index) ? 1 : 0)));
}

/**
 * A language goal's graph sized to reach the level the learner aims for (see
 * `getLanguageLessonTarget`): the situations they haven't settled share the lessons that takes in
 * proportion to their own sizes, so a plan keeps new material until its date instead of weeks of
 * review only, and the time it needs is honest. Sized twice, a graph stays the same. Other goals,
 * and language goals without both levels, keep the sizes their graph gave.
 */
export function sizeLanguageGraph({
  details,
  graph,
  kind,
  settledSkillIds = new Set(),
}: {
  details: unknown;
  graph: PlanGraph;
  kind: GoalKind;
  /** Skills placement or the level test showed the learner knows: they keep their size. */
  settledSkillIds?: ReadonlySet<string>;
}): PlanGraph {
  const own = isJsonObject(details) ? details : {};

  // The level aimed for, as `getTargetLevel` reads it: a target level, else onboarding's CEFR target.
  const aim = [own.targetLevel, own.targetScore].find((value) => parseCefrScore(value) !== null);

  const target = kind === "language" ? getLanguageLessonTarget({ from: own.level, to: aim }) : null;

  const open = graph.skills.filter((skill) => !settledSkillIds.has(skill.skillId));

  if (target === null || open.length === 0) {
    return graph;
  }

  const sizes = scaleSizes({ sizes: open.map((skill) => skill.lessons), total: target });
  const sized = new Map(open.map((skill, index) => [skill.skillId, sizes[index] ?? skill.lessons]));

  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      lessons: sized.get(skill.skillId) ?? skill.lessons,
    })),
  };
}
