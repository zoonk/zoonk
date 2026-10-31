import { type GoalKind } from "@zoonk/db";
import { type CefrLevel, MAX_CEFR_SCORE, parseCefrScore, toCefrLevel } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph } from "./plan-state";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";

const MINUTES_PER_HOUR = 60;

/**
 * Cambridge English's guided learning hours (support.cambridgeenglish.org), the middle of each
 * range; A1, which it doesn't list, at half of A2.
 */
const GUIDED_HOURS: Readonly<Record<CefrLevel, number>> = {
  A1: 95,
  A2: 190,
  B1: 375,
  B2: 550,
  C1: 750,
  C2: 1100,
};

const OWN_LEVEL_HOURS: Readonly<Record<string, number>> = {
  advanced: GUIDED_HOURS.C1,
  basic: GUIDED_HOURS.A2,
  intermediate: GUIDED_HOURS.B1,
  none: 0,
};

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

export function sizeLanguageGraph({
  details,
  graph,
  kind,
  settledSkillIds = new Set(),
}: {
  details: unknown;
  graph: PlanGraph;
  kind: GoalKind;
  settledSkillIds?: ReadonlySet<string>;
}): PlanGraph {
  const own = isJsonObject(details) ? details : {};

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
