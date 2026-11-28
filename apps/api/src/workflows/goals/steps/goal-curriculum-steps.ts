import { type ServiceTier, chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkMemberCoverage } from "@zoonk/ai/tasks/curriculum/member-coverage";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { applyGraphCoverage } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { addMemberSkills } from "@zoonk/core/library/curriculum/add-member-skills";
import { beginGoalCurriculum } from "@zoonk/core/library/curriculum/begin-goal-curriculum";
import { getStartedCourseScope } from "@zoonk/core/library/curriculum/course-start-graph";
import {
  type GoalCurriculumInputs,
  loadGoalCurriculumInputs,
} from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { pruneGoalNoticeGraph } from "@zoonk/core/library/curriculum/prune-goal-notice-graph";
import { saveExamSkillGraph } from "@zoonk/core/library/curriculum/reusable-curriculum";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "@zoonk/core/library/curriculum/save-goal-skills";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import {
  toLanguageGoal,
  toScopedGraphPrompt,
} from "@zoonk/core/library/curriculum/shared-graph-prompt";
import { type MemberCheckRequest } from "@zoonk/core/plans/member-check";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { readGraphCoverage } from "./check-graph-coverage";

type GraphProvenance = Awaited<ReturnType<typeof generateSkillGraph>>["provenance"];

type RunScope = { analytics?: ContentAnalytics; workflowRunId: string };

export async function beginGoalCurriculumStep(input: Parameters<typeof beginGoalCurriculum>[0]) {
  "use step";

  return beginGoalCurriculum(input);
}

export async function loadGoalCurriculumStep(goalId: string): Promise<GoalCurriculumInputs | null> {
  "use step";

  return loadGoalCurriculumInputs(goalId);
}

export function toPrivateScope(goal: GoalCurriculumInputs["goal"]): CurriculumScope {
  return {
    country: goal.contentCountry,
    generalGoal: null,
    language: goal.language,
    ownerId: goal.userId,
    targetLanguage: goal.targetLanguage,
  };
}

export function keepMaterialPrivate({
  inputs,
  scope,
}: {
  inputs: Pick<GoalCurriculumInputs, "goal" | "hasMaterial">;
  scope: CurriculumScope;
}): CurriculumScope {
  return inputs.hasMaterial && !scope.ownerId ? toPrivateScope(inputs.goal) : scope;
}

export async function decideGoalScopeStep({
  analytics,
  inputs,
  workflowRunId,
}: RunScope & { inputs: GoalCurriculumInputs }): Promise<CurriculumScope> {
  "use step";

  const { goal } = inputs;
  const startedCourse = inputs.startedCourse ?? inputs.sourceCourse;

  const shared = {
    country: goal.contentCountry,
    language: goal.language,
    ownerId: null,
    targetLanguage: goal.targetLanguage,
  };

  if (startedCourse) {
    const scope = getStartedCourseScope({ course: startedCourse, goal });
    return inputs.exams.length > 0 ? { ...scope, exams: inputs.exams } : scope;
  }

  if (goal.kind === "language" && goal.targetLanguage) {
    return {
      ...shared,
      generalGoal: toLanguageGoal({ language: goal.language, targetLanguage: goal.targetLanguage }),
    };
  }

  // Lessons from the learner's own material cite it, so they're never shared.
  if (inputs.hasMaterial) {
    return toPrivateScope(goal);
  }

  const { data } = await classifyGoalSpecificity({
    analytics: toContentAnalytics({ analytics, scope: shared, workflowRunId }),
    goal: goal.prompt,
    language: goal.language,
  });

  // A model's general form of the learner's words can still carry their target ("750 points for
  // medicine"), so an exam's shared content is written for the exam.
  const generalGoal = inputs.examIdentity ?? data.generalGoal;

  if (data.privateCourse || !generalGoal) {
    return toPrivateScope(goal);
  }

  return { ...shared, exams: inputs.exams, generalGoal };
}

export async function checkGraphCoverageStep({
  analytics,
  graph,
  inputs,
  references,
  scope,
  workflowRunId,
}: RunScope & {
  graph: GoalSkillGraph;
  inputs: Pick<
    GoalCurriculumInputs,
    "examIdentity" | "goal" | "graphPrompt" | "hasMaterial" | "sharedContext" | "startedCourse"
  >;
  references: GoalCurriculumInputs["references"];
  scope: CurriculumScope;
}): Promise<{ changed: boolean; graph: GoalSkillGraph }> {
  "use step";

  const prompt = toScopedGraphPrompt({ inputs, scope });
  const outline = prompt.goalKind === "exam" ? prompt.examBlueprint : undefined;

  const { data } = await readGraphCoverage({
    graph,
    params: {
      ...prompt,
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      serviceTier: chooseServiceTier({ wait: "learner" }),
    },
    references,
  });

  return applyGraphCoverage({ coverage: data, graph, outline });
}

export type MemberCheckInputs = RunScope & {
  inputs: Pick<
    GoalCurriculumInputs,
    "examIdentity" | "goal" | "graphPrompt" | "hasMaterial" | "sharedContext" | "startedCourse"
  >;
  scope: CurriculumScope;
};

/**
 * The member check reads the goal the way its graph was written, so a shared one never sees the
 * learner's words.
 */
export function toMemberCheckRequest({
  analytics,
  inputs,
  scope,
  workflowRunId,
}: MemberCheckInputs): MemberCheckRequest {
  const prompt = toScopedGraphPrompt({ inputs, scope });

  return {
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    goal: prompt.goal,
    language: prompt.language,
  };
}

/** Adds a skill for each member of the complete list the goal names that the graph leaves out. */
export async function checkGraphMembersStep({
  graph,
  ...input
}: MemberCheckInputs & { graph: GoalSkillGraph }): Promise<GoalSkillGraph> {
  "use step";

  const { data } = await checkMemberCoverage({
    ...toMemberCheckRequest(input),
    serviceTier: chooseServiceTier({ wait: "learner" }),
    skills: graph.skills.map(({ key, name }) => ({ key, name })),
  });

  return addMemberSkills({ coverage: data, graph });
}

export async function pruneNoticeGraphStep(input: Parameters<typeof pruneGoalNoticeGraph>[0]) {
  "use step";

  return pruneGoalNoticeGraph(input);
}

export async function saveGoalSkillsStep({
  analytics,
  courses,
  provenance,
  scope,
  serviceTier,
  skills,
  workflowRunId,
}: RunScope & {
  courses?: GoalSkillGraph["courses"];
  provenance: GraphProvenance;
  scope: CurriculumScope;
  serviceTier?: ServiceTier;
  skills: GoalSkillGraph["skills"];
}): Promise<Record<string, string>> {
  "use step";

  return saveGoalSkills({
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    courses,
    provenance,
    scope,
    serviceTier,
    skills,
  });
}

export async function linkSkillPrerequisitesStep(input: {
  idsByKey: Record<string, string>;
  skills: GoalSkillGraph["skills"];
}): Promise<void> {
  "use step";

  await linkGoalSkillPrerequisites(input);
}

export async function saveExamSkillGraphStep({
  courseIdsByKey,
  graph,
  idsByKey,
  inputs,
  previous,
  provenance,
  scope,
}: {
  courseIdsByKey: Record<string, string>;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  inputs: GoalCurriculumInputs;
  previous?: {
    courseIdsByKey: Record<string, string>;
    graph: GoalSkillGraph;
    idsByKey: Record<string, string>;
  };
  provenance: GraphProvenance;
  scope: CurriculumScope;
}): Promise<void> {
  "use step";

  await saveExamSkillGraph({
    expectedGraph: previous && toGoalPlanGraph(previous),
    graph: toGoalPlanGraph({ courseIdsByKey, graph, idsByKey }),
    inputs,
    provenance: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
    },
    scope,
  });
}
