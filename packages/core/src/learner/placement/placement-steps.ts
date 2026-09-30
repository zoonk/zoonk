import { type ItemFormat } from "@zoonk/db";
import { type PlacementEvidence, type SkillBeliefs } from "./placement-beliefs";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
} from "./placement-graph";
import { type PlacementQuickFormat, getQuickFormatOrder } from "./placement-quick-format";

/**
 * Placement is sure about a skill at 80%: known at or above it, unknown at or below 20%. It stops
 * when every area of every phase has a starting point it is that sure about, not after a set
 * number of questions.
 */
const PLACEMENT_CONFIDENCE = 0.8;

export type SkillPlacementStatus = "known" | "unknown" | "unsure";

/**
 * Where the learner starts in part of the plan: its first skill they can't do yet, null when they
 * can do all of it. Confident when placement is sure of that start in every area of every phase.
 */
type PlacementStart = { confident: boolean; startSkillId: string | null };

/** Where the learner starts in one phase. */
export type PhaseStart = PlacementStart & { phase: number };

/** Where the learner starts in one area of the plan (`PlacementSkill.sectionTitle`). */
export type AreaStart = PlacementStart & { area: string | null };

/** What the learner says about their level before placement: where the walk starts. */
export type OwnLevel = "advanced" | "basic" | "intermediate" | "none";

/** Share of the plan (0 is the first skill) where the first question comes from. */
export const START_POSITIONS: Readonly<Record<OwnLevel, number>> = {
  advanced: 0.75,
  basic: 0.25,
  intermediate: 0.5,
  none: 0,
};

/** Without a stated level, placement starts in the middle of the plan. */
export const DEFAULT_START_POSITION = 0.5;

export function getSkillPlacementStatus(belief: number | undefined): SkillPlacementStatus {
  if (belief === undefined) {
    return "unsure";
  }

  if (belief >= PLACEMENT_CONFIDENCE) {
    return "known";
  }

  return belief <= 1 - PLACEMENT_CONFIDENCE ? "unknown" : "unsure";
}

/** Splits skills (kept in plan order) by a key, in the order each key first appears. */
function groupBy<TKey>(
  skills: readonly PlacementSkill[],
  keyOf: (skill: PlacementSkill) => TKey,
): PlacementSkill[][] {
  return [...Map.groupBy(skills, keyOf).values()];
}

function groupByPhase(skills: readonly PlacementSkill[]): PlacementSkill[][] {
  return groupBy(skills, (skill) => skill.phase).toSorted(
    (a, b) => (a[0]?.phase ?? 0) - (b[0]?.phase ?? 0),
  );
}

function groupByArea(skills: readonly PlacementSkill[]): PlacementSkill[][] {
  return groupBy(skills, (skill) => skill.sectionTitle);
}

/**
 * The parts of the plan that each get their own starting point: one area in one phase. A goal
 * with one area (most learn goals) is placed phase by phase; an exam's subjects each get theirs,
 * so a wrong answer in math never settles where history starts.
 */
function groupByPhaseAndArea(skills: readonly PlacementSkill[]): PlacementSkill[][] {
  return groupBy(skills, (skill) => JSON.stringify([skill.phase, skill.sectionTitle]));
}

/**
 * A part of the plan starts at its first skill the learner can't yet do. The start is confident
 * when placement is sure that skill is unknown, or when the whole part is known.
 */
function getStart({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): PlacementStart {
  const start = skills.find((skill) => getSkillPlacementStatus(beliefs.get(skill.id)) !== "known");

  return {
    confident: !start || getSkillPlacementStatus(beliefs.get(start.id)) === "unknown",
    startSkillId: start?.id ?? null,
  };
}

/** A phase's or an area's start, confident only once each area of each phase in it is. */
function getSettledStart({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): PlacementStart {
  return {
    confident: groupByPhaseAndArea(skills).every(
      (group) => getStart({ beliefs, skills: group }).confident,
    ),
    startSkillId: getStart({ beliefs, skills }).startSkillId,
  };
}

/** Where each phase starts: its first skill the learner can't yet do. */
export function getPhaseStarts({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): PhaseStart[] {
  return groupByPhase(buildSkillGraph(skills).ordered).map((phaseSkills) => ({
    ...getSettledStart({ beliefs, skills: phaseSkills }),
    phase: phaseSkills[0]?.phase ?? 0,
  }));
}

/** Where each area starts, in the order the plan reaches them: the estimate per area. */
export function getAreaStarts({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): AreaStart[] {
  return groupByArea(buildSkillGraph(skills).ordered).map((areaSkills) => ({
    ...getSettledStart({ beliefs, skills: areaSkills }),
    area: areaSkills[0]?.sectionTitle ?? null,
  }));
}

/**
 * Whether placement is sure where every area of every phase starts. A plan without skills yet
 * isn't: there's nothing to place.
 */
export function isPlacementSettled({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): boolean {
  return skills.length > 0 && getSettledStart({ beliefs, skills }).confident;
}

/** "I'd rather start from scratch": every phase starts at its first skill. */
export function getScratchPhaseStarts(skills: readonly PlacementSkill[]): PhaseStart[] {
  return groupByPhase(buildSkillGraph(skills).ordered).map((phaseSkills) => ({
    confident: true,
    phase: phaseSkills[0]?.phase ?? 0,
    startSkillId: phaseSkills[0]?.id ?? null,
  }));
}

/** "I'd rather start from scratch": every area starts at its first skill. */
export function getScratchAreaStarts(skills: readonly PlacementSkill[]): AreaStart[] {
  return groupByArea(buildSkillGraph(skills).ordered).map((areaSkills) => ({
    area: areaSkills[0]?.sectionTitle ?? null,
    confident: true,
    startSkillId: areaSkills[0]?.id ?? null,
  }));
}

/**
 * Skills that still decide a starting point: unsure skills of each area of each phase that isn't
 * settled, from that part's current start onward. Skills after a confident start don't matter yet.
 */
export function getUndecidedSkills({
  beliefs,
  skills,
}: {
  beliefs: SkillBeliefs;
  skills: readonly PlacementSkill[];
}): PlacementSkill[] {
  return groupByPhaseAndArea(buildSkillGraph(skills).ordered).flatMap((group) => {
    const start = getStart({ beliefs, skills: group });

    if (start.confident) {
      return [];
    }

    const startOrder = group.find((skill) => skill.id === start.startSkillId)?.order ?? 0;

    return group.filter(
      (skill) =>
        skill.order >= startOrder && getSkillPlacementStatus(beliefs.get(skill.id)) === "unsure",
    );
  });
}

function pickMedian(skills: readonly PlacementSkill[]): PlacementSkill | null {
  return skills.toSorted((a, b) => a.order - b.order)[Math.floor((skills.length - 1) / 2)] ?? null;
}

/** The candidate closest to `position` (0 is the first skill, 1 the last) of `ordered`. */
function pickNearest({
  candidates,
  ordered,
  position,
}: {
  candidates: readonly PlacementSkill[];
  ordered: readonly PlacementSkill[];
  position: number;
}): PlacementSkill | null {
  const targetIndex = position * Math.max(0, ordered.length - 1);
  const rankOf = (skill: PlacementSkill) => ordered.findIndex((other) => other.id === skill.id);

  return (
    candidates.toSorted(
      (a, b) => Math.abs(rankOf(a) - targetIndex) - Math.abs(rankOf(b) - targetIndex),
    )[0] ?? null
  );
}

function countAnswersByArea({
  evidence,
  graph,
}: {
  evidence: readonly PlacementEvidence[];
  graph: SkillGraph;
}): Map<string | null, number> {
  return evidence.reduce((counts, answer) => {
    const skill = graph.byId.get(answer.skillId);

    return skill
      ? counts.set(skill.sectionTitle, (counts.get(skill.sectionTitle) ?? 0) + 1)
      : counts;
  }, new Map<string | null, number>());
}

/**
 * The area to ask about next: the one with the fewest answers so far, so every area (a weak one
 * included) is sampled before placement goes deep in any. Ties go to the area the plan reaches
 * first.
 */
function pickArea({
  candidates,
  evidence,
  graph,
}: {
  candidates: readonly PlacementSkill[];
  evidence: readonly PlacementEvidence[];
  graph: SkillGraph;
}): string | null {
  const counts = countAnswersByArea({ evidence, graph });
  const inPlanOrder = candidates.toSorted((a, b) => a.order - b.order);
  const areas = [...new Set(inPlanOrder.map((skill) => skill.sectionTitle))];
  const countOf = (area: string | null) => counts.get(area) ?? 0;

  return areas.reduce(
    (best, area) => (countOf(area) < countOf(best) ? area : best),
    areas[0] ?? null,
  );
}

/**
 * The tutor's direction after the last answer: after a right answer, harder skills that build on it
 * (or anything later in the plan); after a wrong one or "I don't know yet", its prerequisites (or
 * anything earlier). With nothing in that direction, any undecided skill.
 */
function getDirectionalPool({
  candidates,
  graph,
  last,
}: {
  candidates: readonly PlacementSkill[];
  graph: SkillGraph;
  last: PlacementEvidence;
}): readonly PlacementSkill[] {
  const lastSkill = graph.byId.get(last.skillId);
  const isCorrect = last.outcome === "correct";
  const direction = isCorrect ? "dependents" : "prerequisites";
  const related = collectRelated({ direction, graph, skillId: last.skillId });
  const linked = candidates.filter((skill) => related.has(skill.id));

  if (linked.length > 0) {
    return linked;
  }

  if (!lastSkill) {
    return candidates;
  }

  const onSide = candidates.filter((skill) =>
    isCorrect ? skill.order > lastSkill.order : skill.order < lastSkill.order,
  );

  return onSide.length > 0 ? onSide : candidates;
}

/**
 * Chooses the next skill to ask about. Areas take turns (the one with the fewest answers first),
 * so every area is sampled before placement goes deep in one. An area's first question comes from
 * where the learner's own level points (the middle by default); later ones bisect toward harder
 * or easier skills of that area after its last answer, so a long plan settles in a few questions
 * instead of one per skill. Only skills with an unseen question (`askableSkillIds`) can be asked;
 * null means nothing more can be asked right now.
 */
export function chooseNextPlacementSkill({
  askableSkillIds,
  beliefs,
  evidence,
  ownLevel,
  skills,
}: {
  askableSkillIds: ReadonlySet<string>;
  beliefs: SkillBeliefs;
  evidence: readonly PlacementEvidence[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
}): string | null {
  const graph = buildSkillGraph(skills);

  const candidates = getUndecidedSkills({ beliefs, skills }).filter((skill) =>
    askableSkillIds.has(skill.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  const area = pickArea({ candidates, evidence, graph });
  const inArea = candidates.filter((skill) => skill.sectionTitle === area);
  const last = evidence.findLast((answer) => graph.byId.get(answer.skillId)?.sectionTitle === area);

  if (!last) {
    const position = ownLevel ? START_POSITIONS[ownLevel] : DEFAULT_START_POSITION;
    const ordered = graph.ordered.filter((skill) => skill.sectionTitle === area);

    return pickNearest({ candidates: inArea, ordered, position })?.id ?? null;
  }

  return pickMedian(getDirectionalPool({ candidates: inArea, graph, last }))?.id ?? null;
}

/** A question from the shared item bank that placement could ask. */
export type PlacementItemCandidate = {
  /** The item bank's difficulty (easy -1, medium 0, hard 1); unknown reads as medium. */
  difficulty?: number | null;
  format: ItemFormat;
  id: string;
  seen: boolean;
  skillId: string;
};

const CONFIRMING_FORMATS: readonly ItemFormat[] = ["typed", "numeric", "spoken"];

/**
 * Where a format ranks for the next question, 0 first: the goal's quick format to cover breadth;
 * formats a guess can't pass to confirm, then the quick ones in the goal's order.
 */
function getFormatRank({
  confirming,
  format,
  quickFormat,
}: {
  confirming: boolean;
  format: ItemFormat;
  quickFormat: PlacementQuickFormat;
}) {
  const quick = getQuickFormatOrder(quickFormat);
  const preferred = confirming ? [...CONFIRMING_FORMATS, ...quick] : quick;
  const index = preferred.indexOf(format);

  return index === -1 ? preferred.length : index;
}

function getDifficultyGap({ item, target }: { item: PlacementItemCandidate; target: number }) {
  return Math.abs((item.difficulty ?? 0) - target);
}

/**
 * Picks an unseen question for a skill: a quick one in the goal's quick format to cover breadth the
 * first time (`quickFormat`: an exam that judges assertions asks true or false), and a typed or
 * numeric one to confirm a skill the learner already got right, since those are hard to guess.
 * Among those, the one closest to `targetDifficulty` (see `getTargetDifficulty`).
 */
export function pickPlacementItem({
  confirming,
  items,
  quickFormat = "multipleChoice",
  skillId,
  targetDifficulty = 0,
}: {
  confirming: boolean;
  items: readonly PlacementItemCandidate[];
  quickFormat?: PlacementQuickFormat;
  skillId: string;
  targetDifficulty?: number;
}): PlacementItemCandidate | null {
  return (
    items
      .filter((item) => item.skillId === skillId && !item.seen)
      .toSorted(
        (a, b) =>
          getFormatRank({ confirming, format: a.format, quickFormat }) -
            getFormatRank({ confirming, format: b.format, quickFormat }) ||
          getDifficultyGap({ item: a, target: targetDifficulty }) -
            getDifficultyGap({ item: b, target: targetDifficulty }),
      )[0] ?? null
  );
}
