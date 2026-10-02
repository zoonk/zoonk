import { type ItemFormat } from "@zoonk/db";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
} from "./placement-graph";

/** "I don't know yet" is its own outcome: honest, and stronger evidence than a wrong guess. */
type PlacementOutcome = "correct" | "dontKnow" | "wrong";

/** One answer on one of the goal's skills, in the order it was given. */
export type PlacementEvidence = { format: ItemFormat; outcome: PlacementOutcome; skillId: string };

/** The chance (0 to 1) that the learner can already do each skill. */
export type SkillBeliefs = ReadonlyMap<string, number>;

/** Before any answer, placement has no opinion about a skill. */
const PRIOR_BELIEF = 0.5;

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
 * Updates the answered skill, then its neighbors: a right answer raises every prerequisite to at
 * least the transferred belief, and a wrong one lowers every dependent to at most it.
 */
function applyEvidence({
  beliefs,
  evidence,
  graph,
}: {
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

/**
 * Replays every answer on the goal's skills, oldest first, into a belief per skill. Answers on
 * skills outside the graph are ignored.
 */
export function getPlacementBeliefs({
  evidence,
  skills,
}: {
  evidence: readonly PlacementEvidence[];
  skills: readonly PlacementSkill[];
}): SkillBeliefs {
  const graph = buildSkillGraph(skills);
  const initial: SkillBeliefs = new Map(skills.map((skill) => [skill.id, PRIOR_BELIEF]));

  return evidence.reduce(
    (beliefs, answer) => applyEvidence({ beliefs, evidence: answer, graph }),
    initial,
  );
}
