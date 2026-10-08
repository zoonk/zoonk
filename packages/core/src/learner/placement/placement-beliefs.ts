import { type CourseLevel, type ItemFormat } from "@zoonk/db";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
  getBandRank,
} from "./placement-graph";
import { type OwnLevel } from "./placement-steps";

/** "I don't know yet" is its own outcome: honest, and stronger evidence than a wrong guess. */
type PlacementOutcome = "correct" | "dontKnow" | "wrong";

/** One answer on one of the goal's skills, in the order it was given. */
export type PlacementEvidence = { format: ItemFormat; outcome: PlacementOutcome; skillId: string };

/** The chance (0 to 1) that the learner can already do each skill. */
export type SkillBeliefs = ReadonlyMap<string, number>;

/** Before any answer, placement has no opinion about a skill. */
const PRIOR_BELIEF = 0.5;

/** A band the learner's level covers: known until an answer says otherwise. */
const KNOWN_BY_LEVEL = 0.85;

/** A band the learner's level likely covers: one right answer is enough to be sure. */
const LIKELY_BY_LEVEL = 0.65;

/**
 * What the learner's own level says before any answer, by a skill's band: someone who studied the
 * subject before ("intermediate") has its overview and beginner skills, so placement asks about
 * what's left and the plan starts past them. "I know it well" leans toward its intermediate ones
 * too. Without a level, or starting from nothing, nothing is assumed. A level never settles the band
 * an area mostly teaches on its own (`getLevelPrior`).
 */
const LEVEL_PRIORS: Readonly<Record<OwnLevel, Partial<Record<CourseLevel, number>>>> = {
  advanced: { beginner: KNOWN_BY_LEVEL, intermediate: LIKELY_BY_LEVEL, overview: KNOWN_BY_LEVEL },
  basic: { overview: KNOWN_BY_LEVEL },
  intermediate: { beginner: KNOWN_BY_LEVEL, overview: KNOWN_BY_LEVEL },
  none: {},
};

/** A learner who can do the skill still gets it wrong this often. */
const SLIP_RATE = 0.1;

/** Someone who can do a skill rarely says "I don't know yet". */
const DONT_KNOW_WHEN_KNOWN = 0.02;

/**
 * How strongly one skill speaks for its neighbors: doing a skill means its prerequisites are very
 * likely known too, and missing one means what builds on it is very likely unknown.
 */
const GRAPH_TRANSFER = 0.95;

/**
 * The chance of a right answer by luck. Quick formats are easy to guess, so they need
 * confirmation; typed and numeric answers barely are, so a lucky guess can't skip a phase.
 */
const GUESS_RATES: Readonly<Record<ItemFormat, number>> = {
  essay: 0.05,
  matchPairs: 0.1,
  multipleChoice: 0.25,
  numeric: 0.02,
  order: 0.1,
  spoken: 0.05,
  trueFalse: 0.5,
  typed: 0.02,
};

function getLikelihoods({ format, outcome }: Pick<PlacementEvidence, "format" | "outcome">) {
  const guess = GUESS_RATES[format];

  if (outcome === "correct") {
    return { known: 1 - SLIP_RATE, unknown: guess };
  }

  if (outcome === "wrong") {
    return { known: SLIP_RATE, unknown: 1 - guess };
  }

  return { known: DONT_KNOW_WHEN_KNOWN, unknown: 1 };
}

/** Bayes' rule for one answer on a skill whose prior belief is `prior`. */
function getPosterior({ evidence, prior }: { evidence: PlacementEvidence; prior: number }): number {
  const { known, unknown } = getLikelihoods(evidence);
  return (prior * known) / (prior * known + (1 - prior) * unknown);
}

/**
 * How basic a skill is within its subject: its band, and inside a band its subject's foundations
 * before what builds on them. Null without a band.
 */
function getSkillDepth(skill: PlacementSkill | undefined): number | null {
  return skill?.band ? getBandRank(skill.band) * 2 + (skill.foundation ? 0 : 1) : null;
}

/**
 * The skills of the answered skill's subject that are more basic (after a right answer) or less
 * basic (after a wrong one): doing a subject's intermediate skill says its beginner ones are done,
 * as doing what builds on its foundations says the foundations are; missing a basic one says
 * what's past it isn't known either. Skills outside the graph's subjects, or without a band, have
 * none.
 */
function getDepthNeighbors({
  graph,
  isCorrect,
  skillId,
}: {
  graph: SkillGraph;
  isCorrect: boolean;
  skillId: string;
}): string[] {
  const skill = graph.byId.get(skillId);
  const depth = getSkillDepth(skill);

  if (!skill || depth === null || skill.sectionTitle === null) {
    return [];
  }

  return graph.ordered
    .filter((other) => {
      const otherDepth = getSkillDepth(other);

      return (
        other.id !== skillId &&
        other.sectionTitle === skill.sectionTitle &&
        otherDepth !== null &&
        (isCorrect ? otherDepth < depth : otherDepth > depth)
      );
    })
    .map((other) => other.id);
}

/**
 * Updates the answered skill, then its neighbors. More basic skills of its subject (or less basic
 * ones, after a wrong answer) take the answer as their own evidence, so a few answers across a
 * subject add up. Then a right answer raises every prerequisite to at least the transferred belief, and a
 * wrong one lowers every dependent to at most it.
 */
function applyEvidence({
  answeredOnly,
  beliefs,
  evidence,
  graph,
}: {
  answeredOnly: boolean;
  beliefs: SkillBeliefs;
  evidence: PlacementEvidence;
  graph: SkillGraph;
}): SkillBeliefs {
  const prior = beliefs.get(evidence.skillId);

  if (prior === undefined) {
    return beliefs;
  }

  const posterior = getPosterior({ evidence, prior });
  const next = new Map(beliefs).set(evidence.skillId, posterior);
  const isCorrect = evidence.outcome === "correct";

  // An answer settles only its own skill when every skill is on the test (`answeredOnly`): a miss
  // on the membrane says nothing of the organelles, which placement still asks.
  if (answeredOnly) {
    return next;
  }

  getDepthNeighbors({ graph, isCorrect, skillId: evidence.skillId }).forEach((skillId) => {
    next.set(skillId, getPosterior({ evidence, prior: next.get(skillId) ?? PRIOR_BELIEF }));
  });

  const related = collectRelated({
    direction: isCorrect ? "prerequisites" : "dependents",
    graph,
    skillId: evidence.skillId,
  });

  related.forEach((skillId) => {
    const current = next.get(skillId) ?? PRIOR_BELIEF;

    const transferred = isCorrect
      ? Math.max(current, posterior * GRAPH_TRANSFER)
      : Math.min(current, 1 - (1 - posterior) * GRAPH_TRANSFER);

    next.set(skillId, transferred);
  });

  return next;
}

/** A subject the learner says they know well reads like having studied it before. */
const KNOWN_AREA_LEVEL: OwnLevel = "intermediate";

/** The band most of these skills are in, the higher one on a tie; -1 when none has a band. */
function getMainBandRank(skills: readonly PlacementSkill[]): number {
  const ranks = skills.flatMap((skill) => (skill.band ? [getBandRank(skill.band)] : []));
  const countOf = (rank: number) => ranks.filter((other) => other === rank).length;

  return ranks.toSorted((a, b) => countOf(b) - countOf(a) || b - a)[0] ?? -1;
}

/**
 * The band each area mostly teaches, by area: the band most of its skills are in, the higher one on
 * a tie. That's the depth the goal asks of the area, which the learner's level is measured against.
 */
function getAreaBandRanks(skills: readonly PlacementSkill[]): Map<string | null, number> {
  return new Map(
    [...Map.groupBy(skills, (skill) => skill.sectionTitle)].map(([area, areaSkills]) => [
      area,
      getMainBandRank(areaSkills),
    ]),
  );
}

/**
 * What the learner's own level says about a skill's band. The level is about the goal ("I know a
 * little of it"), so it covers the bands below the one the area mostly teaches; at that band and
 * above it's at most likely, and one right answer confirms it. Saying "I know a little" of an
 * overview goal, which is all overview, asks before skipping anything.
 */
function getLevelPrior({
  areaBandRank,
  level,
  skill,
}: {
  areaBandRank: number;
  level: OwnLevel | null;
  skill: PlacementSkill;
}): number {
  const prior = (level && skill.band && LEVEL_PRIORS[level][skill.band]) || 0;
  const isAreaDepth = skill.band ? getBandRank(skill.band) >= areaBandRank : false;

  return isAreaDepth ? Math.min(prior, LIKELY_BY_LEVEL) : prior;
}

/**
 * A skill's belief before any answer: what the learner's own level says about its band, or, in a
 * subject they said they know well, what having studied it before says, and that its foundations
 * are known. That matters for an exam, which asks a school subject all at one band: knowing the
 * subject then means knowing its foundations, not only the bands below the exam's.
 */
function getPriorBelief({
  areaBandRank,
  knownAreas,
  ownLevel,
  skill,
}: {
  /** The band the skill's area mostly teaches (`getAreaBandRanks`). */
  areaBandRank: number;
  knownAreas: ReadonlySet<string>;
  ownLevel: OwnLevel | null;
  skill: PlacementSkill;
}): number {
  const knownArea = skill.sectionTitle !== null && knownAreas.has(skill.sectionTitle);
  const areaPrior = (knownArea && skill.band && LEVEL_PRIORS[KNOWN_AREA_LEVEL][skill.band]) || 0;

  return Math.max(
    PRIOR_BELIEF,
    knownArea && skill.foundation ? KNOWN_BY_LEVEL : 0,
    areaPrior,
    getLevelPrior({ areaBandRank, level: ownLevel, skill }),
  );
}

/**
 * Replays every answer on the goal's skills, oldest first, into a belief per skill, starting from
 * what the learner's own level (and the subjects they know well) says about each skill's band.
 * Answers on skills outside the graph are ignored.
 */
export function getPlacementBeliefs({
  answeredOnly = false,
  evidence,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  /**
   * Only answers on a skill settle it: a test from the learner's own material asks every topic of
   * it, so neither a stated level nor an answer on another topic settles one. A miss that lowered
   * what builds on it settled those topics as unknown, and placement ended after three questions.
   */
  answeredOnly?: boolean;
  evidence: readonly PlacementEvidence[];
  /** Subjects (areas) the learner said they already know well, such as an exam's. */
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): SkillBeliefs {
  const graph = buildSkillGraph(skills);
  const known = new Set(answeredOnly ? [] : knownAreas);
  const areaBandRanks = getAreaBandRanks(skills);

  const initial: SkillBeliefs = new Map(
    skills.map((skill) => [
      skill.id,
      getPriorBelief({
        areaBandRank: areaBandRanks.get(skill.sectionTitle) ?? -1,
        knownAreas: known,
        ownLevel: answeredOnly ? null : ownLevel,
        skill,
      }),
    ]),
  );

  return evidence.reduce(
    (beliefs, answer) => applyEvidence({ answeredOnly, beliefs, evidence: answer, graph }),
    initial,
  );
}
