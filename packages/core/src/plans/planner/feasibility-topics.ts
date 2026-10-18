import { toTopicKey } from "../../library/exams/topic-key";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { type PlanGraphSkill } from "./plan-state";
import { findFrequentSkillIds } from "./topic-weights";

/**
 * No topic waits: every skill the plan teaches has a lesson completed, tested out or scheduled, or
 * teaches only topics another skill with lessons teaches too, so its topics are in, as the subject
 * pages and the topics sheet say (one of the organelles' two skills cut, "Organelles" still in).
 * Skills it doesn't teach (an area taken out, ones the learner showed they know or starts past)
 * don't count: one right answer frees a topic from its lessons, never from practice.
 */
/** Skills with completed, tested-out or scheduled teaching; lessons set aside earn no credit. */
function listPlannedSkillIds(built: BuiltPlan): Set<string> {
  return new Set(
    built.items.flatMap((item) =>
      item.status !== "skipped" &&
      (item.kind === "lesson" || item.kind === "chapter") &&
      item.skillId
        ? [item.skillId]
        : [],
    ),
  );
}

export function hasEveryTopic({
  built,
  known,
  skills,
}: {
  built: BuiltPlan;
  known: ReadonlySet<string>;
  skills: readonly PlanGraphSkill[];
}): boolean {
  const planned = listPlannedSkillIds(built);

  const topicsOf = new Map(
    skills.map((skill) => [skill.skillId, (skill.topics ?? []).map((topic) => toTopicKey(topic))]),
  );

  const plannedTopics = new Set([...planned].flatMap((skillId) => topicsOf.get(skillId) ?? []));

  const isInPlan = (skillId: string) => {
    const topics = topicsOf.get(skillId) ?? [];

    return (
      planned.has(skillId) ||
      known.has(skillId) ||
      (topics.length > 0 && topics.every((topic) => plannedTopics.has(topic)))
    );
  };

  return built.skillMinutes.every((entry) => isInPlan(entry.skillId));
}

type SkillFits = ReadonlyMap<string, number>;

function getMeanFit({ ids, skillFits }: { ids: readonly string[]; skillFits: SkillFits }) {
  return ids.reduce((sum, id) => sum + (skillFits.get(id) ?? 1), 0) / Math.max(ids.length, 1);
}

/**
 * Whether the skills on the topics the exam asks most (`high`) keep more of their depth than the
 * rest: Pedro's reveal said his 30 minutes studied "the ones that come up most in more depth"
 * while organelles, his most asked topic, had no lessons since he answered it right. Skills the
 * learner showed they know are left out of both sides.
 */
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
