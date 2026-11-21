import { type GoalSkillNode } from "../_utils/goal-skill-graph";
import { isSkillConfirmed } from "../_utils/skill-claims";
import { type PlacementEvidence } from "./placement-beliefs";
import { buildSkillGraph, collectRelated } from "./placement-graph";

const MISSES_TO_PRUNE = 2;
const EMPTY_CHAPTER_LIMIT = 2;

function didConfirm(answers: readonly PlacementEvidence[]) {
  return isSkillConfirmed({
    answers: answers.map((answer) => ({
      ...answer,
      isCorrect: answer.outcome === "correct",
      itemId: answer.itemId ?? null,
    })),
  });
}

export function readWholeCourseWalk({
  answers,
  partAnsweredItemIds,
  skills,
}: {
  answers: readonly PlacementEvidence[];
  partAnsweredItemIds: ReadonlySet<string>;
  skills: readonly GoalSkillNode[];
}) {
  const graph = buildSkillGraph(skills);
  const bySkill = Map.groupBy(answers, (answer) => answer.skillId);

  const confirmed = new Set(
    skills.filter((skill) => didConfirm(bySkill.get(skill.id) ?? [])).map((skill) => skill.id),
  );

  const failed = new Set(
    skills
      .filter((skill) => {
        if (confirmed.has(skill.id)) {
          return false;
        }

        const given = bySkill.get(skill.id) ?? [];

        return (
          given.some((answer) => answer.outcome === "dontKnow") ||
          given.filter((answer) => answer.outcome === "wrong").length >= MISSES_TO_PRUNE
        );
      })
      .map((skill) => skill.id),
  );

  const pruned = new Set([
    ...failed,
    ...[...failed].flatMap((skillId) => [
      ...collectRelated({ direction: "dependents", graph, skillId }),
    ]),
  ]);

  const deferred = new Set(
    answers.flatMap((answer) =>
      answer.outcome === "wrong" && answer.itemId && partAnsweredItemIds.has(answer.itemId)
        ? [answer.skillId]
        : [],
    ),
  );

  const chapters = Map.groupBy(skills, (skill) => skill.areaId);
  const unresolved = (skill: GoalSkillNode) => !confirmed.has(skill.id) && !pruned.has(skill.id);

  const nextTopics = [...chapters.values()].reduce<{
    empty: number;
    stopped: boolean;
    topics: GoalSkillNode[];
  }>(
    ({ empty, stopped, topics }, chapter) => {
      if (stopped) {
        return { empty, stopped, topics };
      }

      const open = chapter.filter((skill) => unresolved(skill));
      const hasConfirmation = chapter.some((skill) => confirmed.has(skill.id));
      const nextEmpty = open.length === 0 && !hasConfirmation ? empty + 1 : 0;

      return {
        empty: nextEmpty,
        stopped: nextEmpty >= EMPTY_CHAPTER_LIMIT,
        topics: [...topics, ...open],
      };
    },
    { empty: 0, stopped: false, topics: [] },
  );

  return {
    confirmed,
    ready: nextTopics.topics.filter((skill) => !deferred.has(skill.id)),
    remaining: nextTopics.topics,
  };
}
