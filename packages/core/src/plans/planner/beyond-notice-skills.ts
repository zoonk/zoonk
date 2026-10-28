import { splitClosing } from "./core-first";
import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type QueueUnit } from "./plan-units";

function hasTopics(skill: PlanGraphSkill): boolean {
  return (skill.topics ?? []).length > 0;
}

export function findBeyondNoticeSkillIds(graph: PlanGraph): Set<string> {
  const listed = new Set(
    graph.skills.filter((skill) => hasTopics(skill)).map((skill) => getSkillArea({ graph, skill })),
  );

  return new Set(
    graph.skills
      .filter(
        (skill) =>
          !hasTopics(skill) &&
          // Unknown topics (an outline older than notice topics) aren't a declared absence; an
          // empty list is.
          !(skill.outlined && skill.topics === undefined) &&
          !skill.outcome &&
          listed.has(getSkillArea({ graph, skill })),
      )
      .map((skill) => skill.skillId),
  );
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
