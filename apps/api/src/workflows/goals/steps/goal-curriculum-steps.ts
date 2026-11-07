import { createStepStream } from "@/workflows/_shared/stream-status";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { generateSkillGraph, isEmptySkillGraphError } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { applyGraphCoverage } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { getStartedCourseScope } from "@zoonk/core/library/curriculum/course-start-graph";
import { findExamLibrary } from "@zoonk/core/library/curriculum/exam-library-skills";
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
import { type CurriculumScope, getScopeModel } from "@zoonk/core/library/curriculum/scope";
import {
  isSharedExamGraph,
  toLanguageGoal,
  toScopedGraphPrompt,
} from "@zoonk/core/library/curriculum/shared-graph-prompt";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
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

type FindLibrarySkills = NonNullable<Parameters<typeof generateSkillGraph>[0]["findLibrarySkills"]>;

/**
 * A shared exam's graph reads the skills other exams use in its courses, found once its frame names
 * them; `courseIdsByTitle` keeps those courses, so its skills are placed where they were found.
 */
function toExamLibrary({
  analytics,
  inputs,
  scope,
}: {
  analytics: ReturnType<typeof toContentAnalytics>;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): { courseIdsByTitle: Record<string, string>; find?: FindLibrarySkills } {
  const examBlueprintId = inputs.goal.examBlueprintId;
  const courseIdsByTitle: Record<string, string> = {};

  if (
    !examBlueprintId ||
    !inputs.graphPrompt.examBlueprint ||
    !isSharedExamGraph({ inputs, scope })
  ) {
    return { courseIdsByTitle };
  }

  return {
    courseIdsByTitle,
    find: async ({ courses, provenance }) => {
      const library = await findExamLibrary({
        analytics,
        courses,
        examBlueprintId,
        provenance,
        scope,
      });

      Object.assign(courseIdsByTitle, library.courseIdsByTitle);
      return library.skills;
    },
  };
}

function toFrameCourseIds({
  courseIdsByTitle,
  graph,
}: {
  courseIdsByTitle: Readonly<Record<string, string>>;
  graph: GoalSkillGraph;
}): Record<string, string> {
  return Object.fromEntries(
    graph.courses.flatMap((course) => {
      const courseId = courseIdsByTitle[normalizeString(course.title)];
      return courseId ? [[course.key, courseId]] : [];
    }),
  );
}

async function generateGraph({
  analytics,
  findLibrarySkills,
  onSkillNamed,
  prompt,
  scope,
}: {
  analytics: ReturnType<typeof toContentAnalytics>;
  findLibrarySkills?: FindLibrarySkills;
  onSkillNamed: (name: string) => Promise<void>;
  prompt: GoalCurriculumInputs["graphPrompt"];
  scope: CurriculumScope;
}) {
  const model = getScopeModel(scope);

  const params = {
    ...prompt,
    analytics,
    findLibrarySkills,
    onSkillNamed,
    serviceTier: chooseServiceTier({ wait: "learner" }),
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
  /** The courses a shared exam's frame was found in, by the graph's course keys. */
  frameCourseIds: Record<string, string>;
  graph: GoalSkillGraph;
  provenance: GraphProvenance;
}> {
  "use step";

  await using stream = createStepStream<GoalStreamStep>();
  const report = { entityId: inputs.goal.id, step: "buildSkillGraph" } as const;
  await stream.status({ ...report, status: "started" });

  const context = toContentAnalytics({ analytics, scope, workflowRunId });
  const library = toExamLibrary({ analytics: context, inputs, scope });

  const { data, provenance } = await generateGraph({
    analytics: context,
    findLibrarySkills: library.find,
    onSkillNamed: (skillName) => stream.status({ ...report, skillName, status: "started" }),
    prompt: toScopedGraphPrompt({ inputs, scope }),
    scope,
  });

  await stream.status({ ...report, status: "completed" });

  return {
    frameCourseIds: toFrameCourseIds({ courseIdsByTitle: library.courseIdsByTitle, graph: data }),
    graph: data,
    provenance,
  };
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

  const coverage = await checkCoverage({
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    examOutline: outline,
    goal: prompt.goal,
    goalKind: prompt.goalKind,
    language: prompt.language,
    references,
    serviceTier: chooseServiceTier({ wait: "learner" }),
    skills: graph.skills.map(({ area, description, examWeight, key, name, topics }) => ({
      area,
      description,
      examWeight,
      key,
      name,
      topics,
    })),
  });

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

  return saveGoalSkills({
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    provenance,
    scope,
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
