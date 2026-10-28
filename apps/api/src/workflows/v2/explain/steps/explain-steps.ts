import { createStepStream } from "@/workflows/_shared/stream-status";
import { classifyQuestionGenerality } from "@zoonk/ai/tasks/v2/explain/question-generality";
import {
  type QuickExplanation,
  generateQuickExplanation,
} from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { findOrCreateGoalCourse } from "@zoonk/core/library/curriculum/find-or-create-course";
import { type ExplainGoal, loadExplainGoal } from "@zoonk/core/library/explanations/explain-goal";
import {
  type ExplanationStep,
  toExplanationSteps,
} from "@zoonk/core/library/explanations/explanation-steps";
import {
  type SavedExplanation,
  findExplanationGoFurther,
  findExplanationLesson,
  linkExplanationToGoal,
  linkGoFurtherCourse,
  saveExplanationLesson,
} from "@zoonk/core/library/explanations/save";
import { resolveLibraryIdentity } from "@zoonk/core/library/identity/resolve";
import { createSkill } from "@zoonk/core/library/skills/create";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type ExplanationStreamStep } from "./explain-progress-step";

type ExplanationProvenance = Awaited<ReturnType<typeof generateQuickExplanation>>["provenance"];

type RunScope = { analytics?: ContentAnalytics; workflowRunId: string };

export type QuestionSkill =
  | { existingLessonId: string | null; kind: "existing"; skillId: string }
  | { identityKey: string; kind: "new" };

export async function loadExplainGoalStep(goalId: string): Promise<ExplainGoal | null> {
  "use step";

  return loadExplainGoal(goalId);
}

export async function classifyQuestionStep({ goal }: { goal: ExplainGoal }): Promise<boolean> {
  "use step";

  await using stream = createStepStream<ExplanationStreamStep>();
  await stream.status({ entityId: goal.id, status: "started", step: "classifyQuestion" });

  const { isGeneral } = await withAiRetry(() =>
    classifyQuestionGenerality({
      analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
      question: goal.question,
    }),
  );

  await stream.status({ entityId: goal.id, status: "completed", step: "classifyQuestion" });

  return isGeneral;
}

export async function resolveQuestionSkillStep({
  analytics,
  goal,
  ownerId,
  workflowRunId,
}: RunScope & { goal: ExplainGoal; ownerId: string | null }): Promise<QuestionSkill> {
  "use step";

  await using stream = createStepStream<ExplanationStreamStep>();
  await stream.status({ entityId: goal.id, status: "started", step: "findExplanation" });

  const skill = await findQuestionSkill({ analytics, goal, ownerId, workflowRunId });

  await stream.status({ entityId: goal.id, status: "completed", step: "findExplanation" });

  return skill;
}

async function findQuestionSkill({
  analytics,
  goal,
  ownerId,
  workflowRunId,
}: RunScope & { goal: ExplainGoal; ownerId: string | null }): Promise<QuestionSkill> {
  const scope = { language: goal.language, ownerId, targetLanguage: null };

  const request = {
    ...scope,
    description: goal.question,
    goal: null,
    kind: "skill" as const,
    name: goal.question,
  };

  const resolution = await withAiRetry(() =>
    resolveLibraryIdentity({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      request,
    }),
  );

  if (resolution.kind === "existing") {
    const existingLessonId = await findExplanationLesson({ ownerId, skillId: resolution.id });
    return { existingLessonId, kind: "existing", skillId: resolution.id };
  }

  return { identityKey: resolution.identityKey, kind: "new" };
}

export async function writeExplanationStep({
  analytics,
  goal,
  ownerId,
  workflowRunId,
}: RunScope & { goal: ExplainGoal; ownerId: string | null }): Promise<{
  explanation: QuickExplanation;
  problems: string[];
  provenance: ExplanationProvenance;
  steps: ExplanationStep[];
}> {
  "use step";

  await using stream = createStepStream<ExplanationStreamStep>();
  await stream.status({ entityId: goal.id, status: "started", step: "writeExplanation" });

  const { data, provenance } = await withAiRetry(() =>
    generateQuickExplanation({
      analytics: toContentAnalytics({ analytics, scope: { ownerId }, workflowRunId }),
      language: goal.language,
      question: goal.question,
    }),
  );

  const { problems, steps } = toExplanationSteps(data);

  return { explanation: data, problems, provenance, steps };
}

async function createQuestionSkill({
  explanation,
  goal,
  identityKey,
  provenance,
  scope,
}: {
  explanation: QuickExplanation;
  goal: ExplainGoal;
  identityKey: string;
  provenance: ExplanationProvenance;
  scope: { language: string; ownerId: string | null };
}): Promise<string> {
  // A shared skill never carries the asker's own words.
  const created = await createSkill({
    ...scope,
    description: explanation.title,
    example: null,
    identityKey,
    level: "overview",
    name: scope.ownerId ? goal.question : explanation.title,
    provenance,
    targetLanguage: null,
  });

  return created.skill.id;
}

/**
 * A new question skill is created here, not when it's resolved, so a question nobody answered
 * never leaves a skill without its explanation behind.
 */
export async function saveExplanationStep({
  explanation,
  goal,
  ownerId,
  provenance,
  skill,
  steps,
  workflowRunId,
}: {
  explanation: QuickExplanation;
  goal: ExplainGoal;
  ownerId: string | null;
  provenance: ExplanationProvenance;
  skill: QuestionSkill;
  steps: ExplanationStep[];
  workflowRunId: string;
}): Promise<SavedExplanation & { skillId: string }> {
  "use step";

  const scope = { language: goal.language, ownerId };

  const skillId =
    skill.kind === "existing"
      ? skill.skillId
      : await createQuestionSkill({
          explanation,
          goal,
          identityKey: skill.identityKey,
          provenance,
          scope,
        });

  const saved = await saveExplanationLesson({
    explanation,
    provenance,
    scope,
    skillId,
    steps,
    workflowRunId,
  });

  await linkExplanationToGoal({
    courseId: null,
    goalId: goal.id,
    relatedQuestions: explanation.goFurther.relatedQuestions,
    skill: { id: skillId, name: goal.question },
    title: explanation.title,
  });

  await using stream = createStepStream<ExplanationStreamStep>();
  await stream.status({ entityId: goal.id, status: "completed", step: "writeExplanation" });

  return { ...saved, skillId };
}

export async function findGoFurtherCourseStep({
  language,
  provenance,
  title,
}: {
  language: string;
  provenance: ExplanationProvenance;
  title: string;
}): Promise<{ courseId: string; created: boolean } | null> {
  "use step";

  if (!title.trim()) {
    return null;
  }

  const { course, created } = await withAiRetry(() =>
    findOrCreateGoalCourse({
      format: "core",
      provenance,
      scope: { language, ownerId: null, targetLanguage: null },
      title: title.trim(),
    }),
  );

  return { courseId: course.id, created };
}

export async function linkExplanationToGoalStep(
  input: Parameters<typeof linkExplanationToGoal>[0],
): Promise<void> {
  "use step";

  await linkExplanationToGoal(input);
}

export async function linkGoFurtherCourseStep(
  input: Parameters<typeof linkGoFurtherCourse>[0],
): Promise<void> {
  "use step";

  await linkGoFurtherCourse(input);
}

export async function findExplanationGoFurtherStep(lessonId: string) {
  "use step";

  return findExplanationGoFurther(lessonId);
}
