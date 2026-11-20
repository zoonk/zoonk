import { toTopicKey } from "../../library/exams/topic-key";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { LEARN_KINDS } from "./plan-item-rules";
import { type PlanGraphSkill } from "./plan-state";
import { findFrequentSkillIds } from "./topic-weights";

function listPlannedSkillIds(items: BuiltPlan["items"]): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.status !== "skipped" && LEARN_KINDS.has(item.kind) && item.skillId ? [item.skillId] : [],
    ),
  );
}

export function readTopicMembership({
  items,
  known,
  skills,
}: {
  items: BuiltPlan["items"];
  known: ReadonlySet<string>;
  skills: readonly PlanGraphSkill[];
}): (skillId: string) => boolean {
  const planned = listPlannedSkillIds(items);

  const topicsOf = new Map(
    skills.map((skill) => [skill.skillId, (skill.topics ?? []).map((topic) => toTopicKey(topic))]),
  );

  const plannedTopics = new Set([...planned].flatMap((skillId) => topicsOf.get(skillId) ?? []));

  return (skillId) => {
    const topics = topicsOf.get(skillId) ?? [];

    return (
      planned.has(skillId) ||
      known.has(skillId) ||
      (topics.length > 0 && topics.every((topic) => plannedTopics.has(topic)))
    );
  };
}

type SkillFits = ReadonlyMap<string, number>;

function getMeanFit({ ids, skillFits }: { ids: readonly string[]; skillFits: SkillFits }) {
  return ids.reduce((sum, id) => sum + (skillFits.get(id) ?? 1), 0) / Math.max(ids.length, 1);
}

export function deepensMostAsked({
  input,
  known,
  skillFits,
}: {
  input: BuildPlanInput;
  known: ReadonlySet<string>;
  skillFits: SkillFits;
}): boolean {
  const frequent = findFrequentSkillIds({ graph: input.graph, levels: input.topicLevels ?? [] });
  const planned = [...skillFits.keys()].filter((id) => !known.has(id));
  const most = planned.filter((id) => frequent.has(id));
  const rest = planned.filter((id) => !frequent.has(id));

  return (
    most.length > 0 &&
    rest.length > 0 &&
    getMeanFit({ ids: most, skillFits }) > getMeanFit({ ids: rest, skillFits })
  );
}
