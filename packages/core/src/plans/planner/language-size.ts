import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { apportion } from "@zoonk/utils/apportion";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { getCefrHours, getStartHours } from "../../language/aims/language-aims";
import { AIM_BANDS } from "../../language/aims/language-bands";
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

function getLessonCount(hours: number): number {
  const lessonShare = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });
  return Math.round((hours * MINUTES_PER_HOUR * lessonShare) / DEFAULT_LESSON_MINUTES);
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
 * Each band's open situations share the lessons left after its settled situations, with at least one per situation. A band that
 * gets none of the hours keeps its situations' sizes.
 */
function resize({
  aim,
  bandOf,
  graph,
  leftOut,
  settledSkillIds,
  start,
}: {
  aim: number;
  bandOf: (skill: PlanGraphSkill) => CourseLevel;
  graph: PlanGraph;
  leftOut: ReadonlySet<string>;
  settledSkillIds: ReadonlySet<string>;
  start: number;
}): PlanGraph {
  const byBand = Map.groupBy(
    graph.skills.filter((skill) => !leftOut.has(skill.skillId)),
    bandOf,
  );

  const sized = new Map(
    [...byBand].flatMap(([band, skills]) => {
      const total = getLessonCount(getStudiedHours({ aim, band, start }));

      if (total === 0) {
        return [];
      }

      const open = skills.filter((skill) => !settledSkillIds.has(skill.skillId));

      const settled = skills.reduce(
        (count, skill) => count + (settledSkillIds.has(skill.skillId) ? skill.lessons : 0),
        0,
      );

      const sizes = apportion({
        minimumOneIfPossible: true,
        total: Math.max(open.length, total - settled),
        weights: open.map((skill) => skill.lessons),
      });

      return open.map((skill, index) => [skill.skillId, sizes[index] ?? 1] as const);
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

/** A graph written before every band had situations still owes its empty bands' hours. */
function listUnwrittenBands({
  aim,
  bandOf,
  graph,
  start,
}: {
  aim: number;
  bandOf: (skill: PlanGraphSkill) => CourseLevel;
  graph: PlanGraph;
  start: number;
}): CourseLevel[] {
  const written = new Set(graph.skills.map((skill) => bandOf(skill)));

  return BAND_ORDER.filter(
    (band) => !written.has(band) && getStudiedHours({ aim, band, start }) > 0,
  );
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

  const studied = start !== null && aim > start;

  const sized = markPastLevel({
    covered,
    graph: studied ? resize({ aim, bandOf, graph, leftOut, settledSkillIds, start }) : graph,
  });

  const missing = studied ? listUnwrittenBands({ aim, bandOf, graph, start }) : [];

  const unwrittenLessons = missing.reduce(
    (sum, band) => sum + getLessonCount(getStudiedHours({ aim, band, start: start ?? 0 })),
    0,
  );

  const skills = sized.skills.filter((skill) => !leftOut.has(skill.skillId));
  const lastPhase = Math.max(-1, ...skills.map((skill) => skill.phase));
  const phases = leftOut.size > 0 ? sized.phases.slice(0, lastPhase + 1) : sized.phases;

  return {
    graph: sized,
    planned: {
      ...sized,
      ...(unwrittenLessons > 0 && { unwrittenLessons }),
      phases: [
        ...phases,
        ...missing.map((band) => ({
          later: true as const,
          milestone: null,
          name: CEFR_LEVELS.filter((level) => AIM_BANDS[level] === band).join("–"),
        })),
      ],
      skills,
    },
  };
}
