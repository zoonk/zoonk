import { splitClosing } from "./core-first";
import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type QueueUnit } from "./plan-units";

function hasTopics(skill: PlanGraphSkill): boolean {
  return (skill.topics ?? []).length > 0;
}

/**
 * The skills of an exam's subjects that teach none of the topics its notice lists for their
 * subject, while other skills of that subject do: what the skill graph added beyond the notice,
 * such as the 26 lessons on digital-records formats it gave Rafaela's IT subject for her role,
 * whose notice asks about Office, the internet, security and data. A subject none of whose skills
 * lists a topic has none, and a written test's skills never are: they practice what its rubric asks.
 */
export function findBeyondNoticeSkillIds(graph: PlanGraph): Set<string> {
  const listed = new Set(
    graph.skills.filter((skill) => hasTopics(skill)).map((skill) => getSkillArea({ graph, skill })),
  );

  return new Set(
    graph.skills
      .filter(
        (skill) =>
          !hasTopics(skill) &&
          // Published outline skills can predate notice topic metadata. Unknown isn't a declared
          // absence; an explicit empty topics list still says the skill is beyond the notice.
          !(skill.outlined && skill.topics === undefined) &&
          !skill.outcome &&
          listed.has(getSkillArea({ graph, skill })),
      )
      .map((skill) => skill.skillId),
  );
}

/**
 * The skills beyond the notice (`beyond`) that a `planned` skill builds on, directly or through
 * other skills beyond it: what a topic of the notice can't be learned without, one of the plan's
 * bases, which the learner studies as they choose (see `findPlanBases`), before what needs it.
 */
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

/**
 * An exam's units with each skill beyond the notice that nothing planned builds on (see
 * `findBeyondNoticeBases`) after everything else, as depth, before the checkpoint that closes the
 * plan: it never takes the place of a topic the exam asks, and a plan short on time cuts it first
 * (see `putCoresFirst`). The rest of a chapter the learner is in stays where it is, and so does a
 * lesson on what a class test announces.
 */
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
