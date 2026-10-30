import { createStepStream } from "@/workflows/_shared/stream-status";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import {
  generateSkillGraph,
  isEmptySkillGraphError,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/v2/identity/goal-specificity";
import { applyGraphCoverage } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { getStartedCourseScope } from "@zoonk/core/library/curriculum/course-start-graph";
import {
  type GoalCurriculumInputs,
  loadGoalCurriculumInputs,
} from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { saveExamSkillGraph } from "@zoonk/core/library/curriculum/reusable-curriculum";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "@zoonk/core/library/curriculum/save-goal-skills";
import {
  type CurriculumScope,
  getContentReuse,
  getScopeModel,
  getScopeReuse,
} from "@zoonk/core/library/curriculum/scope";
import { toScopedGraphPrompt } from "@zoonk/core/library/curriculum/shared-graph-prompt";
import { safeAsync } from "@zoonk/utils/error";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type GoalStreamStep } from "./goal-progress-step";

type GraphProvenance = Awaited<ReturnType<typeof generateSkillGraph>>["provenance"];

type RunScope = { analytics?: ContentAnalytics; workflowRunId: string };

export async function loadGoalCurriculumStep(goalId: string): Promise<GoalCurriculumInputs | null> {
  "use step";

  return loadGoalCurriculumInputs(goalId);
}

function toPrivateScope(goal: GoalCurriculumInputs["goal"]): CurriculumScope {
  return {
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

  const { goal, startedCourse } = inputs;
  const shared = { language: goal.language, ownerId: null, targetLanguage: goal.targetLanguage };

  if (startedCourse) {
    const scope = getStartedCourseScope({ course: startedCourse, goal });
    return inputs.exams.length > 0 ? { ...scope, exams: inputs.exams } : scope;
  }

  if (goal.kind === "language") {
    return { ...shared, generalGoal: goal.title };
  }

  // Lessons from the learner's own material cite it, so they're never shared.
  if (inputs.hasMaterial) {
    return toPrivateScope(goal);
  }

  const { data } = await withAiRetry(() =>
    classifyGoalSpecificity({
      analytics: toContentAnalytics({ analytics, scope: shared, workflowRunId }),
      goal: goal.prompt,
      language: goal.language,
    }),
  );

  if (data.privateCourse) {
    return toPrivateScope(goal);
  }

  // A model's general form of the learner's words can still carry their target ("750 points for
  // medicine"), so an exam's shared content is written for the exam.
  const generalGoal = inputs.examIdentity ?? data.generalGoal ?? goal.title;

  return { ...shared, exams: inputs.exams, generalGoal };
}

function getGraphTier({
  goalKind,
  scope,
}: {
  goalKind: GoalCurriculumInputs["graphPrompt"]["goalKind"];
  scope: CurriculumScope;
}) {
  const reuse =
    goalKind === "exam"
      ? getContentReuse({
          forExam: true,
          ownerId: scope.ownerId,
          targetLanguage: scope.targetLanguage,
        })
      : getScopeReuse(scope);

  return chooseServiceTier({ reuse, wait: "learner" });
}

async function generateGraph({
  analytics,
  prompt,
  scope,
}: {
  analytics: ReturnType<typeof toContentAnalytics>;
  prompt: GoalCurriculumInputs["graphPrompt"];
  scope: CurriculumScope;
}) {
  const model = getScopeModel(scope);

  const params = {
    ...prompt,
    analytics,
    serviceTier: getGraphTier({ goalKind: prompt.goalKind, scope }),
  };

  if (!model) {
    return generateSkillGraph(params);
  }

  const cheaper = await safeAsync(() => generateSkillGraph({ ...params, model }));

  if (cheaper.data) {
    return cheaper.data;
  }

  if (isEmptySkillGraphError(cheaper.error)) {
    return generateSkillGraph(params);
  }

  throw cheaper.error;
}

export async function buildSkillGraphStep({
  analytics,
  inputs,
  scope,
  workflowRunId,
}: RunScope & { inputs: GoalCurriculumInputs; scope: CurriculumScope }): Promise<{
  graph: GoalSkillGraph;
  provenance: GraphProvenance;
}> {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();
  await stream.status({ entityId: inputs.goal.id, status: "started", step: "buildSkillGraph" });

  const { data, provenance } = await withAiRetry(() =>
    generateGraph({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      prompt: toScopedGraphPrompt({ inputs, scope }),
      scope,
    }),
  );

  await stream.status({ entityId: inputs.goal.id, status: "completed", step: "buildSkillGraph" });

  return { graph: data, provenance };
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

  const coverage = await withAiRetry(() =>
    checkCoverage({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      examOutline: outline,
      goal: prompt.goal,
      goalKind: prompt.goalKind,
      language: prompt.language,
      references,
      serviceTier: getGraphTier({ goalKind: prompt.goalKind, scope }),
      skills: graph.skills.map(({ area, description, examWeight, key, name, topics }) => ({
        area,
        description,
        examWeight,
        key,
        name,
        topics,
      })),
    }),
  );

  return applyGraphCoverage({ coverage: coverage.data, graph, outline });
}

export async function saveGoalSkillsStep({
  analytics,
  provenance,
  scope,
  skills,
  workflowRunId,
}: RunScope & {
  provenance: GraphProvenance;
  scope: CurriculumScope;
  skills: GoalSkillGraph["skills"];
}): Promise<Record<string, string>> {
  "use step";

  return withAiRetry(() =>
    saveGoalSkills({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      provenance,
      scope,
      skills,
    }),
  );
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
  provenance,
  scope,
}: {
  courseIdsByKey: Record<string, string>;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  inputs: GoalCurriculumInputs;
  provenance: GraphProvenance;
  scope: CurriculumScope;
}): Promise<void> {
  "use step";

  await saveExamSkillGraph({
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
