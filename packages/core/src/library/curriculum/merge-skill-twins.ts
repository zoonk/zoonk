import "server-only";
import { findTwinCandidates, mergeSkillTwins } from "@zoonk/ai/tasks/v2/curriculum/skill-twins";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { type LibraryIdentityItem } from "@zoonk/ai/tasks/v2/identity/subject";
import { safeAsync } from "@zoonk/utils/error";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

function toIdentityItem({
  scope,
  skill,
}: {
  scope: CurriculumScope;
  skill: GraphSkill;
}): LibraryIdentityItem {
  return {
    courses: [skill.area],
    description: skill.description,
    targetLanguage: scope.targetLanguage,
    title: skill.name,
  };
}

async function findTwinOf({
  analytics,
  scope,
  siblings,
  skill,
}: {
  analytics?: CurriculumAnalytics;
  scope: CurriculumScope;
  siblings: readonly GraphSkill[];
  skill: GraphSkill;
}): Promise<[string, string] | null> {
  const { data } = await safeAsync(() =>
    decideLibraryIdentity({
      analytics,
      candidates: siblings.map((sibling) => ({
        id: sibling.key,
        item: toIdentityItem({ scope, skill: sibling }),
      })),
      subject: {
        goal: scope.generalGoal,
        item: toIdentityItem({ scope, skill }),
        kind: "skill",
        language: scope.language,
      },
    }),
  );

  const twin = siblings.find((sibling) => sibling.key === data?.match?.id);
  return twin ? [skill.key, twin.key] : null;
}

function listQuestions({ graph, newKeys }: { graph: GoalSkillGraph; newKeys?: readonly string[] }) {
  const candidates = findTwinCandidates(graph.skills);

  if (!newKeys) {
    return candidates;
  }

  const isNew = (skill: GraphSkill) => newKeys.includes(skill.key);

  return candidates.flatMap(({ siblings, skill }) => {
    const newSiblings = siblings.filter((sibling) => isNew(sibling));
    return isNew(skill) && newSiblings.length > 0 ? [{ siblings: newSiblings, skill }] : [];
  });
}

export async function mergeGraphSkillTwins({
  analytics,
  graph,
  newKeys,
  scope,
}: {
  analytics?: CurriculumAnalytics;
  graph: GoalSkillGraph;
  newKeys?: readonly string[];
  scope: CurriculumScope;
}): Promise<GoalSkillGraph> {
  if (scope.ownerId) {
    return graph;
  }

  const decided = await Promise.all(
    listQuestions({ graph, newKeys }).map(({ siblings, skill }) =>
      findTwinOf({ analytics, scope, siblings, skill }),
    ),
  );

  return mergeSkillTwins({ graph, twins: new Map(decided.filter((twin) => twin !== null)) });
}
