import { splitClosing } from "./core-first";
import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type QueueUnit } from "./plan-units";

function hasTopics(skill: PlanGraphSkill): boolean {
  return (skill.topics ?? []).length > 0;
}

export function findBeyondNoticeSkillIds({
  graph,
  prerequisites,
}: {
  graph: PlanGraph;
  prerequisites?: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  const listed = new Set(
    graph.skills.filter(hasTopics).map((skill) => getSkillArea({ graph, skill })),
  );

  const bases = new Set(prerequisites ? [...prerequisites.values()].flat() : []);

  const isBeyond = (skill: PlanGraphSkill) => {
    if (skill.extra) {
      return true;
    }

    if (listed.size === 0 || skill.outcome || hasTopics(skill)) {
      return false;
    }

    const named = listed.has(getSkillArea({ graph, skill }));
    return skill.topics?.length === 0 || (named ? !skill.outlined : bases.has(skill.skillId));
  };

  return new Set(graph.skills.filter(isBeyond).map((skill) => skill.skillId));
}

export function findBeyondNoticeBases({
  beyond,
  planned,
  prerequisites,
}: {
  beyond: ReadonlySet<string>;
  planned: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  const bases = new Set<string>();

  const visit = (skillId: string): void => {
    (prerequisites.get(skillId) ?? [])
      .filter((id) => beyond.has(id) && !bases.has(id))
      .forEach((id) => {
        bases.add(id);
        visit(id);
      });
  };

  [...planned].filter((skillId) => !beyond.has(skillId)).forEach((skillId) => visit(skillId));

  return bases;
}

export function putBeyondNoticeLast(
  units: readonly QueueUnit[],
  { bases, beyond }: { bases: ReadonlySet<string>; beyond: ReadonlySet<string> },
): QueueUnit[] {
  const isLast = (unit: QueueUnit) =>
    unit.kind === "lesson" &&
    unit.skillId !== null &&
    beyond.has(unit.skillId) &&
    !bases.has(unit.skillId) &&
    !unit.inProgress &&
    !unit.announced;

  const { closing, rest } = splitClosing(units);

  return [
    ...rest.filter((unit) => !isLast(unit)),
    ...rest.filter((unit) => isLast(unit)).map((unit) => ({ ...unit, depth: true })),
    ...(closing ? [closing] : []),
  ];
}
