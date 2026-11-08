import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { type CefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { getCefrHours, getStartHours } from "../../language/aims/language-aims";
import { getBandRank } from "../../learner/placement/placement-graph";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph } from "./plan-state";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";

const MINUTES_PER_HOUR = 60;

/** A language graph files A1 and A2 situations as beginner, B1 and B2 intermediate, C1 and C2 advanced. */
const AIM_BANDS: Readonly<Record<CefrLevel, CourseLevel>> = {
  A1: "beginner",
  A2: "beginner",
  B1: "intermediate",
  B2: "intermediate",
  C1: "advanced",
  C2: "advanced",
};

function getLessonTarget({ aim, start }: { aim: number; start: number }): number {
  const lessonShare = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });
  const lessonMinutes = (getCefrHours(aim) - start) * MINUTES_PER_HOUR * lessonShare;

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

/** Situations in bands above the aim's, so a trip course never reaches C1 conversations. */
function listAboveAim({
  aim,
  bands,
  graph,
  settledSkillIds,
}: {
  aim: CefrLevel;
  bands: ReadonlyMap<string, CourseLevel | null>;
  graph: PlanGraph;
  settledSkillIds: ReadonlySet<string>;
}): Set<string> {
  const ceiling = getBandRank(AIM_BANDS[aim]);

  return new Set(
    graph.skills.flatMap((skill) => {
      const band = bands.get(skill.skillId);

      return band && getBandRank(band) > ceiling && !settledSkillIds.has(skill.skillId)
        ? [skill.skillId]
        : [];
    }),
  );
}

function resize({
  graph,
  leftOut,
  settledSkillIds,
  target,
}: {
  graph: PlanGraph;
  leftOut: ReadonlySet<string>;
  settledSkillIds: ReadonlySet<string>;
  target: number;
}): PlanGraph {
  const open = graph.skills.filter(
    (skill) => !settledSkillIds.has(skill.skillId) && !leftOut.has(skill.skillId),
  );

  if (open.length === 0) {
    return graph;
  }

  const sum = open.reduce((total, skill) => total + skill.lessons, 0);
  const sizes = scaleSizes({ sizes: open.map((skill) => skill.lessons), total: target });
  const sized = new Map(open.map((skill, index) => [skill.skillId, sizes[index] ?? skill.lessons]));

  // Left out at the same scale, so a higher aim later finds each situation's share as it was.
  const scale = (lessons: number) => Math.max(1, Math.round((lessons * target) / sum));

  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      lessons:
        sized.get(skill.skillId) ??
        (leftOut.has(skill.skillId) ? scale(skill.lessons) : skill.lessons),
    })),
  };
}

/**
 * A language goal with an aim studies only the situations up to its band, sized to the hours from
 * the learner's level to the aim when it's above it. `graph` keeps every situation for the plan to
 * save, so a higher aim later brings the rest back; `planned` is what the plan lays out.
 */
export function sizeLanguageGraph({
  aim,
  bands,
  goal,
  graph,
  settledSkillIds = new Set(),
}: {
  aim: CefrLevel | null;
  bands: ReadonlyMap<string, CourseLevel | null>;
  /** Its details hold the level the learner starts from. */
  goal: { details: unknown; kind: GoalKind };
  graph: PlanGraph;
  settledSkillIds?: ReadonlySet<string>;
}): { graph: PlanGraph; planned: PlanGraph } {
  const aimScore = parseCefrScore(aim);
  const start = getStartHours(isJsonObject(goal.details) ? goal.details.level : null);

  if (goal.kind !== "language" || aim === null || aimScore === null) {
    return { graph, planned: graph };
  }

  const leftOut = listAboveAim({ aim, bands, graph, settledSkillIds });
  const ahead = start !== null && getCefrHours(aimScore) > start;

  const sized = ahead
    ? resize({ graph, leftOut, settledSkillIds, target: getLessonTarget({ aim: aimScore, start }) })
    : graph;

  const skills = sized.skills.filter((skill) => !leftOut.has(skill.skillId));
  const lastPhase = Math.max(-1, ...skills.map((skill) => skill.phase));

  return {
    graph: sized,
    // Phases after the aim's last situation would show in the plan with nothing in them.
    planned: { ...sized, phases: sized.phases.slice(0, lastPhase + 1), skills },
  };
}
