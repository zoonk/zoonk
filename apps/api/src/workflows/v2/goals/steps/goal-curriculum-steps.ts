import { createStepStream } from "@/workflows/_shared/stream-status";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import {
  generateSkillGraph,
  isEmptySkillGraphError,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/v2/identity/goal-specificity";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
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
import { createGoalPlan } from "@zoonk/core/plans/create";
import { type PlanSetupTask, listPlanSetupTasks, runPlanSetupTask } from "@zoonk/core/plans/setup";
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

/** A private course for the goal's learner: lessons from their own material, or too specific to share. */
function toPrivateScope(goal: GoalCurriculumInputs["goal"]): CurriculumScope {
  return {
    generalGoal: null,
    language: goal.language,
    ownerId: goal.userId,
    targetLanguage: goal.targetLanguage,
  };
}

/**
 * A goal whose material linked after its scope was decided (an upload while the learner answered
 * onboarding) gets the private course that material always gets: it reaches the graph's context.
 */
export function keepMaterialPrivate({
  inputs,
  scope,
}: {
  inputs: Pick<GoalCurriculumInputs, "goal" | "hasMaterial">;
  scope: CurriculumScope;
}): CurriculumScope {
  return inputs.hasMaterial && !scope.ownerId ? toPrivateScope(inputs.goal) : scope;
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

  // An exam's shared content is written for the exam, never for the general form a model wrote from
  // the learner's words, which can carry their target ("750 points for medicine").
  const generalGoal = inputs.examIdentity ?? data.generalGoal ?? goal.title;

  return { ...shared, exams: inputs.exams, generalGoal };
}

/**
 * The learner watches the graph being built, so an exam's or a language's graph, which later
 * learners of the same notice or language reuse, runs at the priority tier (`chooseServiceTier`).
 * A new exam's graph is an exam's before research finds its notice too: Rafaela's first placement
 * question waited 94 s on hers at the standard tier.
 */
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

/**
 * A private course's graph comes from the cheaper model; when that model returns a graph that
 * can't be used (no course or phase), the default model writes it instead of failing the goal.
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

/**
 * The goal's skill graph: the skills it needs with their prerequisites, the courses and level
 * bands that teach them, and its phases. A shared curriculum's graph reads only the goal's general
 * form and fixed choices (`toScopedGraphPrompt`), never the learner's own words.
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
      prompt: toScopedGraphPrompt({ inputs, scope }),
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
 * corrected. With an exam's notice, every skill is placed in its subjects and topics and every
 * topic gets a skill (see `applyGraphCoverage`). `changed` says whether the graph gained a skill,
 * a weight moved or a skill moved in the notice.
 */
export async function checkGraphCoverageStep({
  analytics,
  graph,
  inputs,
  references,
  scope,
  workflowRunId,
}: RunScope & {
  graph: GoalSkillGraph;
  /** The goal, its language and its exam's notice, read as the skill graph read them. */
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
 * course found for its graph course. Placement can start as soon as this is saved. Returns the
 * setup a new plan owes, which the run does one step per task (`runPlanSetupTaskStep`).
 */
export async function createGoalPlanStep({
  courseIdsByKey,
  followNotice = false,
  goalId,
  graph,
  idsByKey,
  platform,
  provenance,
}: {
  courseIdsByKey: Record<string, string>;
  /** The exam's notice was read before the learner saw the plan: its day becomes the plan's. */
  followNotice?: boolean;
  goalId: string;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  /** The client that started the run, for "Plan Created". */
  platform: AnalyticsPlatform | null;
  provenance: GraphProvenance;
}): Promise<PlanSetupTask[]> {
  "use step";

  const { setupTasks } = await createGoalPlan({
    followNotice,
    goalId,
    graph: toGoalPlanGraph({ courseIdsByKey, graph, idsByKey }),
    platform,
    provenance: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
    },
    setup: "steps",
  });

  return setupTasks;
}

/**
 * Keeps a graph this goal's run wrote as its exam's shared graph, when the goal's graph is the
 * exam's (`saveExamSkillGraph`): the first written for the exam, which only this run completes.
 */
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

/**
 * One setup task the new plan owes (see `runPlanSetupTask`), done once. A failure throws, so the
 * runtime retries it; the routine's fit is a model call, retried after a minute when rate limited.
 */
export async function runPlanSetupTaskStep(input: {
  goalId: string;
  task: PlanSetupTask;
}): Promise<void> {
  "use step";

  await withAiRetry(() => runPlanSetupTask(input));
}

/** The setup the goal's plan still owes, in the order it runs. */
export async function listPlanSetupTasksStep(goalId: string): Promise<PlanSetupTask[]> {
  "use step";

  return listPlanSetupTasks(goalId);
}
