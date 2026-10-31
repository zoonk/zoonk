import { type PlacementEvidence } from "./placement-beliefs";
import {
  type PlacementSkill,
  type SkillGraph,
  buildSkillGraph,
  collectRelated,
} from "./placement-graph";
import { type SkillStatuses, isOpen, statusOf } from "./placement-status";

/** A null startSkillId means every skill in this part is known. */
type PlacementStart = { confident: boolean; startSkillId: string | null };

export type PhaseStart = PlacementStart & { phase: number };

export type AreaStart = PlacementStart & { area: string | null };

export type OwnLevel = "advanced" | "basic" | "intermediate" | "none";

/** Position fraction; zero means the first skill. */
export const START_POSITIONS: Readonly<Record<OwnLevel, number>> = {
  advanced: 0.75,
  basic: 0.25,
  intermediate: 0.5,
  none: 0,
};

export const DEFAULT_START_POSITION = 0.5;

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

function groupByPhaseAndArea(skills: readonly PlacementSkill[]): PlacementSkill[][] {
  return groupBy(skills, (skill) => JSON.stringify([skill.phase, skill.sectionTitle]));
}

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

/** Preserves the order in which the plan reaches each area. */
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

/** Empty plans are unsettled; answeredOnly requires a verdict on every topic, not merely a starting point. */
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

export function getScratchPhaseStarts(skills: readonly PlacementSkill[]): PhaseStart[] {
  return groupByPhase(buildSkillGraph(skills).ordered).map((phaseSkills) => ({
    confident: true,
    phase: phaseSkills[0]?.phase ?? 0,
    startSkillId: phaseSkills[0]?.id ?? null,
  }));
}

export function getScratchAreaStarts(skills: readonly PlacementSkill[]): AreaStart[] {
  return groupByArea(buildSkillGraph(skills).ordered).map((areaSkills) => ({
    area: areaSkills[0]?.sectionTitle ?? null,
    confident: true,
    startSkillId: areaSkills[0]?.id ?? null,
  }));
}

/** answeredOnly includes every unsure topic, even after a confident starting point. */
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

export type AreaPriority = {
  /** Each area's share of the exam (`getAreaShares`): the heaviest is asked first. */
  areaShares?: ReadonlyMap<string, number> | null;
  /** The plan's areas the learner said are weak (`PlanSettings.focusAreas`). */
  focusAreas?: readonly string[];
};

/** Fewest answers first, then weak areas, then exam weight; supplied area order breaks remaining ties. */
export function rankAreasToAsk<TArea extends string | null>({
  answers,
  areaShares,
  areas,
  focusAreas = [],
}: AreaPriority & {
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

/** Only selects askableSkillIds; null means nothing can be asked now. answeredOnly walks every topic in plan order before confirming. */
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
