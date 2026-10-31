import { type CourseLevel, type ItemFormat } from "@zoonk/db";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
  getBandRank,
} from "./placement-graph";
import { PLACEMENT_CONFIDENCE } from "./placement-status";
import { type OwnLevel } from "./placement-steps";

type PlacementOutcome = "correct" | "dontKnow" | "wrong";

/** Evidence must be in answer order. */
export type PlacementEvidence = { format: ItemFormat; outcome: PlacementOutcome; skillId: string };

/** Probability from 0 to 1. */
export type SkillBeliefs = ReadonlyMap<string, number>;

const PRIOR_BELIEF = 0.5;

const KNOWN_BY_LEVEL = 0.85;

const LIKELY_BY_LEVEL = 0.65;

const LEVEL_PRIORS: Readonly<Record<OwnLevel, Partial<Record<CourseLevel, number>>>> = {
  advanced: { beginner: KNOWN_BY_LEVEL, intermediate: LIKELY_BY_LEVEL, overview: KNOWN_BY_LEVEL },
  basic: { overview: KNOWN_BY_LEVEL },
  intermediate: { beginner: KNOWN_BY_LEVEL, overview: KNOWN_BY_LEVEL },
  none: {},
};

const SLIP_RATE = 0.1;

const DONT_KNOW_WHEN_KNOWN = 0.02;

const GRAPH_TRANSFER = 0.95;

/** Quick formats need confirmation because they can be guessed; typed and numeric answers rarely can. */
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

function getPosterior({ evidence, prior }: { evidence: PlacementEvidence; prior: number }): number {
  const { known, unknown } = getLikelihoods(evidence);
  return (prior * known) / (prior * known + (1 - prior) * unknown);
}

function countRightAnswersFrom({ belief, format }: { belief: number; format: ItemFormat }): number {
  if (belief >= PLACEMENT_CONFIDENCE) {
    return 0;
  }

  const evidence: PlacementEvidence = { format, outcome: "correct", skillId: "" };
  return 1 + countRightAnswersFrom({ belief: getPosterior({ evidence, prior: belief }), format });
}

/** Assumes no prior knowledge of the skill. */
export function countRightAnswersToKnow(format: ItemFormat): number {
  return countRightAnswersFrom({ belief: PRIOR_BELIEF, format });
}

function getSkillDepth(skill: PlacementSkill | undefined): number | null {
  return skill?.band ? getBandRank(skill.band) * 2 + (skill.foundation ? 0 : 1) : null;
}

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

  // A test of every topic must still ask other topics after a miss.
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

const KNOWN_AREA_LEVEL: OwnLevel = "intermediate";

function getMainBandRank(skills: readonly PlacementSkill[]): number {
  const ranks = skills.flatMap((skill) => (skill.band ? [getBandRank(skill.band)] : []));
  const countOf = (rank: number) => ranks.filter((other) => other === rank).length;

  return ranks.toSorted((a, b) => countOf(b) - countOf(a) || b - a)[0] ?? -1;
}

function getAreaBandRanks(skills: readonly PlacementSkill[]): Map<string | null, number> {
  return new Map(
    [...Map.groupBy(skills, (skill) => skill.sectionTitle)].map(([area, areaSkills]) => [
      area,
      getMainBandRank(areaSkills),
    ]),
  );
}

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

function getPriorBelief({
  areaBandRank,
  knownAreas,
  ownLevel,
  skill,
}: {
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

/** answeredOnly ignores stated levels and known subjects; only the topic's own answers settle it. */
export function getPlacementPriors({
  answeredOnly = false,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  answeredOnly?: boolean;
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): SkillBeliefs {
  const known = new Set(answeredOnly ? [] : knownAreas);
  const areaBandRanks = getAreaBandRanks(skills);

  return new Map(
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
}

/** Evidence must be oldest first; answers outside the graph are ignored and only own answers justify skipping. */
export function getPlacementBeliefs({
  answeredOnly = false,
  evidence,
  knownAreas = [],
  ownLevel = null,
  skills,
}: {
  /** Ignore stated levels and cross-topic inference for tests that cover every topic. */
  answeredOnly?: boolean;
  evidence: readonly PlacementEvidence[];
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): SkillBeliefs {
  const graph = buildSkillGraph(skills);
  const initial = getPlacementPriors({ answeredOnly, knownAreas, ownLevel, skills });

  return evidence.reduce(
    (beliefs, answer) => applyEvidence({ answeredOnly, beliefs, evidence: answer, graph }),
    initial,
  );
}
