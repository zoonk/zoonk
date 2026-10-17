import { type PlacementEvidence } from "./placement-beliefs";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
} from "./placement-graph";
import { type SkillStatuses, isOpen, statusOf } from "./placement-status";

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
 * A part of the plan starts at its first skill the learner's answers haven't confirmed. The start
 * is confident when placement is sure that skill is unknown, or when the whole part is confirmed.
 */
function getStart({
  skills,
  statuses,
}: {
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): PlacementStart {
  const start = skills.find((skill) => statusOf({ skill, statuses }) !== "known");

  return {
    confident: !start || statusOf({ skill: start, statuses }) === "unknown",
    startSkillId: start?.id ?? null,
  };
}

/** A phase's or an area's start, confident only once each area of each phase in it is. */
function getSettledStart({
  skills,
  statuses,
}: {
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): PlacementStart {
  return {
    confident: groupByPhaseAndArea(skills).every(
      (group) => getStart({ skills: group, statuses }).confident,
    ),
    startSkillId: getStart({ skills, statuses }).startSkillId,
  };
}

/** Where each phase starts: its first skill the learner can't yet do. */
export function getPhaseStarts({
  skills,
  statuses,
}: {
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): PhaseStart[] {
  return groupByPhase(buildSkillGraph(skills).ordered).map((phaseSkills) => ({
    ...getSettledStart({ skills: phaseSkills, statuses }),
    phase: phaseSkills[0]?.phase ?? 0,
  }));
}

/** Where each area starts, in the order the plan reaches them: the estimate per area. */
export function getAreaStarts({
  skills,
  statuses,
}: {
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): AreaStart[] {
  return groupByArea(buildSkillGraph(skills).ordered).map((areaSkills) => ({
    ...getSettledStart({ skills: areaSkills, statuses }),
    area: areaSkills[0]?.sectionTitle ?? null,
  }));
}

/**
 * Whether placement is sure where every area of every phase starts. A test from the learner's own
 * material (`answeredOnly`) is all on the test, so a start isn't enough: placement is sure once it
 * knows each topic, known or not. A plan without skills yet isn't: there's nothing to place.
 */
export function isPlacementSettled({
  answeredOnly = false,
  skills,
  statuses,
}: {
  answeredOnly?: boolean;
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): boolean {
  if (skills.length === 0) {
    return false;
  }

  return answeredOnly
    ? getUndecidedSkills({ answeredOnly, skills, statuses }).length === 0
    : getSettledStart({ skills, statuses }).confident;
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
 * Skills that still decide a starting point: unsure skills, and the ones taken on trust that their
 * own answers haven't confirmed, of each area of each phase that isn't settled, from that part's
 * current start onward. Skills after a confident start don't matter yet, except in a test from the
 * learner's own material (`answeredOnly`), where every unsure topic does: each one is on the test.
 */
export function getUndecidedSkills({
  answeredOnly = false,
  skills,
  statuses,
}: {
  answeredOnly?: boolean;
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): PlacementSkill[] {
  if (answeredOnly) {
    return buildSkillGraph(skills).ordered.filter((skill) => isOpen(statusOf({ skill, statuses })));
  }

  return groupByPhaseAndArea(buildSkillGraph(skills).ordered).flatMap((group) => {
    const start = getStart({ skills: group, statuses });

    if (start.confident) {
      return [];
    }

    const startOrder = group.find((skill) => skill.id === start.startSkillId)?.order ?? 0;

    return group.filter(
      (skill) => skill.order >= startOrder && isOpen(statusOf({ skill, statuses })),
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

/** What decides which area placement asks about next, besides how often each was answered. */
export type AreaPriority = {
  /** Each area's share of the exam (`getAreaShares`): the heaviest is asked first. */
  areaShares?: ReadonlyMap<string, number> | null;
  /** The plan's areas the learner said are weak (`PlanSettings.focusAreas`). */
  focusAreas?: readonly string[];
};

/**
 * Areas in the order placement asks them: the fewest answers first, so every area is sampled
 * before placement goes deep in any; among those, the ones the learner said are weak, then the
 * ones worth most of the exam (the OAB's ethics, 8 of 80 questions), then in the order given (the
 * plan's).
 */
export function rankAreasToAsk<TArea extends string | null>({
  answers,
  areaShares,
  areas,
  focusAreas = [],
}: AreaPriority & {
  /** How many answers each area has so far. */
  answers: ReadonlyMap<string | null, number>;
  areas: readonly TArea[];
}): TArea[] {
  const weak = new Set(focusAreas);
  const isWeak = (area: TArea) => (area !== null && weak.has(area) ? 0 : 1);
  const shareOf = (area: TArea) => (area === null ? 0 : (areaShares?.get(area) ?? 0));

  return areas.toSorted(
    (a, b) =>
      (answers.get(a) ?? 0) - (answers.get(b) ?? 0) ||
      isWeak(a) - isWeak(b) ||
      shareOf(b) - shareOf(a),
  );
}

/** The area to ask about next (`rankAreasToAsk`). */
function pickArea({
  candidates,
  evidence,
  graph,
  priority,
}: {
  candidates: readonly PlacementSkill[];
  evidence: readonly PlacementEvidence[];
  graph: SkillGraph;
  priority: AreaPriority;
}): string | null {
  const inPlanOrder = candidates.toSorted((a, b) => a.order - b.order);
  const areas = [...new Set(inPlanOrder.map((skill) => skill.sectionTitle))];
  const answers = countAnswersByArea({ evidence, graph });

  return rankAreasToAsk({ ...priority, answers, areas })[0] ?? null;
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
 * Chooses the next skill to ask about. Areas take turns (`rankAreasToAsk`: the fewest answers
 * first, then weak ones, then the heaviest), so every area is sampled before placement goes deep in
 * one. An area's first question comes from
 * where the learner's own level points (the middle by default); later ones bisect toward harder
 * or easier skills of that area after its last answer, so a long plan settles in a few questions
 * instead of one per skill. A test from the learner's own material (`answeredOnly`), where an
 * answer settles only its own topic, asks each topic once in the plan's order, then confirms the
 * ones still unsure. In an area, what the learner only said they know (`claimed`) is asked before
 * anything else, the earliest first: it's skipped only once its own answer confirms it. Only skills
 * with an unseen question (`askableSkillIds`) can be asked; null means nothing more can be asked
 * right now.
 */
export function chooseNextPlacementSkill({
  answeredOnly = false,
  areaShares,
  askableSkillIds,
  evidence,
  focusAreas,
  ownLevel,
  skills,
  statuses,
}: AreaPriority & {
  answeredOnly?: boolean;
  askableSkillIds: ReadonlySet<string>;
  evidence: readonly PlacementEvidence[];
  ownLevel?: OwnLevel | null;
  skills: readonly PlacementSkill[];
  statuses: SkillStatuses;
}): string | null {
  const graph = buildSkillGraph(skills);

  const candidates = getUndecidedSkills({ answeredOnly, skills, statuses }).filter((skill) =>
    askableSkillIds.has(skill.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (answeredOnly) {
    const unanswered = candidates.filter(
      (skill) => !evidence.some((answer) => answer.skillId === skill.id),
    );

    return (
      (unanswered.length > 0 ? unanswered : candidates).toSorted((a, b) => a.order - b.order)[0]
        ?.id ?? null
    );
  }

  const area = pickArea({ candidates, evidence, graph, priority: { areaShares, focusAreas } });
  const inArea = candidates.filter((skill) => skill.sectionTitle === area);
  const last = evidence.findLast((answer) => graph.byId.get(answer.skillId)?.sectionTitle === area);

  const claimed = inArea
    .filter((skill) => statusOf({ skill, statuses }) === "claimed")
    .toSorted((a, b) => a.order - b.order);

  if (claimed[0]) {
    return claimed[0].id;
  }

  if (!last) {
    const position = ownLevel ? START_POSITIONS[ownLevel] : DEFAULT_START_POSITION;
    const ordered = graph.ordered.filter((skill) => skill.sectionTitle === area);

    return pickNearest({ candidates: inArea, ordered, position })?.id ?? null;
  }

  return pickMedian(getDirectionalPool({ candidates: inArea, graph, last }))?.id ?? null;
}
