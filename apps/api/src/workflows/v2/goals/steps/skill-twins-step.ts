import { mergeGraphSkillTwins } from "@zoonk/core/library/curriculum/merge-skill-twins";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

/**
 * The graph with each skill it wrote twice in other words merged into one, before its skills are
 * saved in slices (see `mergeGraphSkillTwins`); with `newKeys`, only among the skills about to be
 * saved.
 */
export async function mergeSkillTwinsStep({
  analytics,
  graph,
  newKeys,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  graph: GoalSkillGraph;
  newKeys?: string[];
  scope: CurriculumScope;
  workflowRunId: string;
}): Promise<GoalSkillGraph> {
  "use step";

  return mergeGraphSkillTwins({
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    graph,
    newKeys,
    scope,
  });
}
