import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { CEFR_LEVELS, type CefrLevel, parseCefrScore, toCefrLevel } from "@zoonk/utils/cefr";
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

function getBandHours(band: CourseLevel): { from: number; to: number } {
  const levels = CEFR_LEVELS.flatMap((level, score) => (AIM_BANDS[level] === band ? [score] : []));
  const first = Math.min(...levels);

  return { from: first > 0 ? getCefrHours(first - 1) : 0, to: getCefrHours(Math.max(...levels)) };
}

/**
 * Situations the plan sets aside: those in bands above the aim's (so a trip course never reaches
 * C1 conversations) and those in bands the learner's level already covers, unless they showed a
 * gap in it. The aim's own band always stays, and so does a covered band with nothing after it.
 */
function listLeftOut({
  aim,
  bands,
  graph,
  keepSkillIds,
  start,
  stopsAtAim,
}: {
  aim: number;
  bands: ReadonlyMap<string, CourseLevel | null>;
  graph: PlanGraph;
  keepSkillIds: ReadonlySet<string>;
  start: number | null;
  stopsAtAim: boolean;
}): Set<string> {
  const ceiling = getBandRank(AIM_BANDS[toCefrLevel(aim)]);

  const ranks = graph.skills.flatMap((skill) => {
    const band = bands.get(skill.skillId);
    return band ? [getBandRank(band)] : [];
  });

  const hasLaterBand = (rank: number) => ranks.some((each) => each > rank && each <= ceiling);

  const isCovered = (band: CourseLevel) =>
    start !== null && getBandHours(band).to <= start && hasLaterBand(getBandRank(band));

  const isLeftOut = (band: CourseLevel) =>
    getBandRank(band) > ceiling ? stopsAtAim : isCovered(band);

  return new Set(
    graph.skills.flatMap((skill) => {
      const band = bands.get(skill.skillId);

      return band && isLeftOut(band) && !keepSkillIds.has(skill.skillId) ? [skill.skillId] : [];
    }),
  );
}

/** The hours from the learner's level to the aim that fall in the band's own range. */
function getStudiedHours({ aim, band, start }: { aim: number; band: CourseLevel; start: number }) {
  const { from, to } = getBandHours(band);
  return Math.max(0, Math.min(to, getCefrHours(aim)) - Math.max(from, start));
}

/**
 * Each band's situations share that band's hours, in proportion to their sizes; a situation without
 * a band counts in the aim's. A situation whose band gets none of the hours keeps its size.
 */
function resize({
  aim,
  bands,
  graph,
  open,
  start,
}: {
  aim: number;
  bands: ReadonlyMap<string, CourseLevel | null>;
  graph: PlanGraph;
  open: ReadonlySet<string>;
  start: number;
}): PlanGraph {
  const skills = graph.skills.filter((skill) => open.has(skill.skillId));
  const aimBand = AIM_BANDS[toCefrLevel(aim)];
  const bandOf = (skill: PlanGraphSkill) => bands.get(skill.skillId) ?? aimBand;
  const byBand = Map.groupBy(skills, bandOf);

  const weights = skills.map((skill) => {
    const band = bandOf(skill);
    const bandLessons = (byBand.get(band) ?? []).reduce((sum, each) => sum + each.lessons, 0);

    return (skill.lessons * getStudiedHours({ aim, band, start })) / bandLessons;
  });

  const weighed = skills.filter((_, index) => (weights[index] ?? 0) > 0);

  if (weighed.length === 0) {
    return graph;
  }

  const sizes = scaleSizes({
    sizes: weights.filter((weight) => weight > 0),
    total: getLessonTarget({ aim, start }),
  });

  const sized = new Map(weighed.map((skill, index) => [skill.skillId, sizes[index] ?? 1]));

  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      lessons: sized.get(skill.skillId) ?? skill.lessons,
    })),
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
  goal,
  graph,
  missedSkillIds = new Set(),
  settledSkillIds = new Set(),
  state,
}: {
  bands: ReadonlyMap<string, CourseLevel | null>;
  /** Its details hold the level the learner starts from. */
  goal: { details: unknown; kind: GoalKind };
  graph: PlanGraph;
  /** Situations the learner showed a gap in stay planned below their level. */
  missedSkillIds?: ReadonlySet<string>;
  settledSkillIds?: ReadonlySet<string>;
  /** The aim is a CEFR label, half bands included ("B1+"). */
  state: { goal: Pick<PlanState["goal"], "aim">; settings: Pick<PlanSettings, "stopsAtAim"> };
}): { graph: PlanGraph; planned: PlanGraph } {
  const aimScore = parseCefrScore(state.goal.aim);
  const start = getStartHours(isJsonObject(goal.details) ? goal.details.level : null);

  if (goal.kind !== "language" || aimScore === null) {
    return { graph, planned: graph };
  }

  const leftOut = listLeftOut({
    aim: aimScore,
    bands,
    graph,
    keepSkillIds: new Set([...settledSkillIds, ...missedSkillIds]),
    start,
    stopsAtAim: state.settings.stopsAtAim ?? false,
  });

  const open = new Set(
    graph.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => !settledSkillIds.has(skillId) && !leftOut.has(skillId)),
  );

  const sized =
    start !== null && getCefrHours(aimScore) > start
      ? resize({ aim: aimScore, bands, graph, open, start })
      : graph;

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
