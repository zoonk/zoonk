import "server-only";
import { findTwinCandidates, mergeSkillTwins } from "@zoonk/ai/tasks/v2/curriculum/skill-twins";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { type LibraryIdentityItem } from "@zoonk/ai/tasks/v2/identity/subject";
import { safeAsync } from "@zoonk/utils/error";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

/** A skill as the reuse decision reads it, in its area, as identity search reads a graph's skills. */
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

/** The earlier skill a reuse decision says `skill` is, among the siblings it may repeat. */
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

/**
 * The skills that may repeat an earlier one of their area, each with those earlier skills; with
 * `newKeys`, only new skills and their new siblings, since identity search finds twins of the
 * skills already saved.
 */
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

/**
 * A new shared graph with the skills it wrote twice in other words merged ("Interpret charts
 * and tables" and "Read and compare data in charts and tables" in one area), before its skills
 * reach the Library: identity search only finds rows already saved, and a graph's skills are saved
 * in slices at once, so two twins would each become a skill of their own. Each skill whose name
 * acts on what an earlier skill of its area acts on (`findTwinCandidates`) gets the reuse decision
 * skills get (`decideLibraryIdentity`), with those earlier skills as its candidates, and a twin
 * merges into the skill it repeats (`mergeSkillTwins`). `newKeys` limits it to skills about to be
 * saved, such as those a notice's reading added to a saved graph. A decision that fails keeps
 * both skills. A private graph keeps its skills: the decision's inputs are kept with shared runs,
 * and a private goal's words never are.
 */
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
