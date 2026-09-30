import { createStepStream } from "@/workflows/_shared/stream-status";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import {
  generateSkillGraph,
  isEmptySkillGraphError,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/v2/identity/goal-specificity";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import {
  addCoverageSkills,
  reweightExamSkills,
} from "@zoonk/core/library/curriculum/add-coverage-skills";
import { getStartedCourseScope } from "@zoonk/core/library/curriculum/course-start-graph";
import {
  type GoalCurriculumInputs,
  loadGoalCurriculumInputs,
} from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "@zoonk/core/library/curriculum/save-goal-skills";
import { type CurriculumScope, getScopeModel } from "@zoonk/core/library/curriculum/scope";
import { createGoalPlan } from "@zoonk/core/plans/create";
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

/**
 * Decides who the curriculum is for. A goal too specific to share, or built from the learner's own
 * material, gets a private course; for the rest, only the general part of the goal ever reaches
 * shared content. Language goals are always shared: a language pair is the same for everyone. A
 * goal started from a course is for that course's audience.
 */
export async function decideGoalScopeStep({
  analytics,
  inputs,
  workflowRunId,
}: RunScope & { inputs: GoalCurriculumInputs }): Promise<CurriculumScope> {
  "use step";

  const { goal, startedCourse } = inputs;
  const shared = { language: goal.language, ownerId: null, targetLanguage: goal.targetLanguage };

  if (startedCourse) {
    return getStartedCourseScope({ course: startedCourse, goal });
  }

  if (goal.kind === "language") {
    return { ...shared, generalGoal: goal.title };
  }

  // Lessons built from the learner's own material teach from it and cite it: never shared.
  if (inputs.hasMaterial) {
    return { ...shared, generalGoal: null, ownerId: goal.userId };
  }

  const { data } = await withAiRetry(() =>
    classifyGoalSpecificity({
      analytics: toContentAnalytics({ analytics, scope: shared, workflowRunId }),
      goal: goal.prompt,
      language: goal.language,
    }),
  );

  if (data.privateCourse) {
    return { ...shared, generalGoal: null, ownerId: goal.userId };
  }

  return { ...shared, generalGoal: data.generalGoal ?? goal.title };
}

/**
 * A private course's graph comes from the cheaper model; when that model returns a graph that
 * can't be used (no course or phase), the default model writes it instead of failing the goal.
 * The learner's first lesson waits on the graph, so it's written at the priority tier.
 */
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
  const params = { ...prompt, analytics, serviceTier: "priority" as const };

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

/**
 * The goal's skill graph: the skills it needs with their prerequisites, the courses and level
 * bands that teach them, and its phases.
 */
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
      prompt: inputs.graphPrompt,
      scope,
    }),
  );

  await stream.status({ entityId: inputs.goal.id, status: "completed", step: "buildSkillGraph" });

  return { graph: data, provenance };
}

/**
 * Adds the skills the goal's reference syllabi (an exam notice, a syllabus the learner uploaded,
 * the ones research found) expect and the graph missed. An exam's skills are weighed against
 * them too: the new ones get their weight, and the ones the notice shows are off get theirs
 * corrected. `changed` says whether the graph gained a skill or a weight moved.
 */
export async function checkGraphCoverageStep({
  analytics,
  graph,
  prompt,
  references,
  scope,
  workflowRunId,
}: RunScope & {
  graph: GoalSkillGraph;
  /** What the goal is and in which language, as the skill graph read it. */
  prompt: Pick<GoalCurriculumInputs["graphPrompt"], "goal" | "goalKind" | "language">;
  references: GoalCurriculumInputs["references"];
  scope: CurriculumScope;
}): Promise<{ changed: boolean; graph: GoalSkillGraph }> {
  "use step";

  const coverage = await withAiRetry(() =>
    checkCoverage({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      goal: prompt.goal,
      goalKind: prompt.goalKind,
      language: prompt.language,
      references,
      skills: graph.skills.map(({ description, examWeight, key, name }) => ({
        description,
        examWeight,
        key,
        name,
      })),
    }),
  );

  const { examWeights, missing } = coverage.data;

  return {
    changed: examWeights.length > 0 || missing.length > 0,
    graph: addCoverageSkills({ graph: reweightExamSkills({ examWeights, graph }), missing }),
  };
}

/** A slice of the graph's skills in the Library; retried slices find the skills they created. */
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

/**
 * Builds the plan from the graph at the learner's daily minutes: phases with dates, and one stand-in
 * per skill until the outlines give it lessons. Each skill's lessons come only from the Library
 * course found for its graph course. Placement can start as soon as this is saved.
 */
export async function createGoalPlanStep({
  courseIdsByKey,
  goalId,
  graph,
  idsByKey,
  platform,
  provenance,
}: {
  courseIdsByKey: Record<string, string>;
  goalId: string;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  /** The client that started the run, for "Plan Created". */
  platform: AnalyticsPlatform | null;
  provenance: GraphProvenance;
}): Promise<boolean> {
  "use step";

  const result = await createGoalPlan({
    goalId,
    graph: toGoalPlanGraph({ courseIdsByKey, graph, idsByKey }),
    platform,
    provenance: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
    },
  });

  return result.status === "created";
}
