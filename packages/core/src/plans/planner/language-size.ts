import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { getCefrHours, getStartHours } from "../../language/aims/language-aims";
import { getBandRank } from "../../learner/placement/placement-graph";
import { getLearningShare } from "./plan-phases";
import {
  type PlanGraph,
  type PlanGraphSkill,
  type PlanSettings,
  type PlanState,
} from "./plan-state";
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

function getLessonCount(hours: number): number {
  const lessonShare = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });
  return Math.round((hours * MINUTES_PER_HOUR * lessonShare) / DEFAULT_LESSON_MINUTES);
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

const BAND_ORDER = [...new Set(Object.values(AIM_BANDS))];

function getBandHours(band: CourseLevel): { from: number; to: number } {
  const levels = CEFR_LEVELS.flatMap((level, score) => (AIM_BANDS[level] === band ? [score] : []));
  const first = Math.min(...levels);

  return { from: first > 0 ? getCefrHours(first - 1) : 0, to: getCefrHours(Math.max(...levels)) };
}

/** The band whose hours reach `hours`, so an aim of A2+ reaches into the intermediate band. */
function getBandAt(hours: number): CourseLevel {
  return BAND_ORDER.find((band) => getBandHours(band).to >= hours) ?? "advanced";
}

/** The hours from the learner's level to the aim that fall in the band's own range. */
function getStudiedHours({ aim, band, start }: { aim: number; band: CourseLevel; start: number }) {
  const { from, to } = getBandHours(band);
  return Math.max(0, Math.min(to, aim) - Math.max(from, start));
}

/**
 * Situations the plan sets aside: those in bands above the aim's, so a trip course never reaches
 * C1 conversations, and those in bands the learner's level already covers when a later band has
 * situations to plan. A situation without a band counts in the aim's.
 */
function listLeftOut({
  aim,
  bandOf,
  coveredKept,
  graph,
  settledSkillIds,
  start,
  stopsAtAim,
}: {
  aim: number;
  bandOf: (skill: PlanGraphSkill) => CourseLevel;
  /** Situations a covered band keeps, such as ones the learner started. */
  coveredKept: ReadonlySet<string>;
  graph: PlanGraph;
  settledSkillIds: ReadonlySet<string>;
  start: number | null;
  stopsAtAim: boolean;
}): { aboveAim: Set<string>; covered: Set<string> } {
  const ceiling = getBandRank(getBandAt(aim));
  const ranks = graph.skills.map((skill) => getBandRank(bandOf(skill)));
  const hasLaterBand = (rank: number) => ranks.some((each) => each > rank && each <= ceiling);

  const isAboveAim = (skill: PlanGraphSkill) =>
    stopsAtAim && getBandRank(bandOf(skill)) > ceiling && !settledSkillIds.has(skill.skillId);

  const isCovered = (skill: PlanGraphSkill) => {
    const band = bandOf(skill);

    return (
      start !== null &&
      getBandHours(band).to <= start &&
      hasLaterBand(getBandRank(band)) &&
      !coveredKept.has(skill.skillId)
    );
  };

  const idsWhere = (test: (skill: PlanGraphSkill) => boolean) =>
    new Set(graph.skills.filter((skill) => test(skill)).map((skill) => skill.skillId));

  return { aboveAim: idsWhere(isAboveAim), covered: idsWhere(isCovered) };
}

/**
 * Each band's situations share the lessons for that band's hours, in proportion to their sizes. A
 * band that gets none of the hours keeps its situations' sizes.
 */
function resize({
  aim,
  bandOf,
  graph,
  open,
  start,
}: {
  aim: number;
  bandOf: (skill: PlanGraphSkill) => CourseLevel;
  graph: PlanGraph;
  open: ReadonlySet<string>;
  start: number;
}): PlanGraph {
  const byBand = Map.groupBy(
    graph.skills.filter((skill) => open.has(skill.skillId)),
    bandOf,
  );

  const sized = new Map(
    [...byBand].flatMap(([band, skills]) => {
      const total = getLessonCount(getStudiedHours({ aim, band, start }));

      if (total === 0) {
        return [];
      }

      const sizes = scaleSizes({ sizes: skills.map((skill) => skill.lessons), total });
      return skills.map((skill, index) => [skill.skillId, sizes[index] ?? 1] as const);
    }),
  );

  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      lessons: sized.get(skill.skillId) ?? skill.lessons,
    })),
  };
}

function markPastLevel({ covered, graph }: { covered: ReadonlySet<string>; graph: PlanGraph }) {
  return {
    ...graph,
    skills: graph.skills.map(({ pastLevel: _marked, ...skill }) =>
      covered.has(skill.skillId) ? { ...skill, pastLevel: true } : skill,
    ),
  };
}

/**
 * A language goal with an aim studies the situations from the learner's level up to the aim's
 * band, each band sized to its share of the hours from that level to the aim. `graph` keeps every
 * situation for the plan to save, so a higher aim or a lower level later brings the rest back;
 * `planned` is what the plan lays out.
 */
export function sizeLanguageGraph({
  bands,
  currentLevel,
  goal,
  graph,
  keepSkillIds = new Set(),
  settledSkillIds = new Set(),
  state,
}: {
  bands: ReadonlyMap<string, CourseLevel | null>;
  currentLevel?: string | null;
  /** Its details hold the level the learner starts from. */
  goal: { details: unknown; kind: GoalKind };
  graph: PlanGraph;
  /** Situations that stay planned below the learner's level, such as ones they started. */
  keepSkillIds?: ReadonlySet<string>;
  settledSkillIds?: ReadonlySet<string>;
  /** The aim is a CEFR label, half bands included ("B1+"). */
  state: { goal: Pick<PlanState["goal"], "aim">; settings: Pick<PlanSettings, "stopsAtAim"> };
}): { graph: PlanGraph; planned: PlanGraph } {
  const aimScore = parseCefrScore(state.goal.aim);

  const start = getStartHours(
    currentLevel ?? (isJsonObject(goal.details) ? goal.details.level : null),
  );

  if (goal.kind !== "language") {
    return { graph, planned: graph };
  }

  if (aimScore === null) {
    const unmarked = markPastLevel({ covered: new Set(), graph });
    return { graph: unmarked, planned: unmarked };
  }

  const aim = getCefrHours(aimScore);
  const aimBand = getBandAt(aim);
  const bandOf = (skill: PlanGraphSkill) => bands.get(skill.skillId) ?? aimBand;

  const { aboveAim, covered } = listLeftOut({
    aim,
    bandOf,
    coveredKept: new Set([...settledSkillIds, ...keepSkillIds]),
    graph,
    settledSkillIds,
    start,
    stopsAtAim: state.settings.stopsAtAim ?? false,
  });

  const leftOut = new Set([...aboveAim, ...covered]);

  const open = new Set(
    graph.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => !settledSkillIds.has(skillId) && !leftOut.has(skillId)),
  );

  const sized = markPastLevel({
    covered,
    graph: start !== null && aim > start ? resize({ aim, bandOf, graph, open, start }) : graph,
  });

  if (leftOut.size === 0) {
    return { graph: sized, planned: sized };
  }

  const skills = sized.skills.filter((skill) => !leftOut.has(skill.skillId));
  const lastPhase = Math.max(-1, ...skills.map((skill) => skill.phase));

  return {
    graph: sized,
    // Phases after the aim's last situation would show in the plan with nothing in them.
    planned: { ...sized, phases: sized.phases.slice(0, lastPhase + 1), skills },
  };
}
