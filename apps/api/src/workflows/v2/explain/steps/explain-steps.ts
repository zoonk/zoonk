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

/**
 * The question's skill and the explanation someone already asked for, or the identity key a new
 * question skill is created under once its explanation is written.
 */
export type QuestionSkill =
  | { existingLessonId: string | null; kind: "existing"; skillId: string }
  | { identityKey: string; kind: "new" };

export async function loadExplainGoalStep(goalId: string): Promise<ExplainGoal | null> {
  "use step";

  return loadExplainGoal(goalId);
}

/**
 * Whether the explanation would be the same for anyone who asks. Only a confident "general" is
 * shared: a personal answer shown to strangers is worse than writing one more explanation.
 */
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

/**
 * The question as a Library skill: a general question finds the same question asked in other
 * words through identity search, and with it the explanation already written for it. A personal
 * question gets a skill of its own that nobody else ever sees.
 */
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

/**
 * Writes the quick explanation on a fast model (the first screen should show in about 20 seconds)
 * and checks it: 4 to 6 screens, one right answer, a reason on every option and screens that pass
 * the step contract. The problems say what failed. Writing is reported done once the explanation
 * is saved and can be read (`saveExplanationStep`).
 */
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
  const created = await createSkill({
    ...scope,
    description: explanation.title,
    example: null,
    identityKey,
    level: "overview",
    name: goal.question,
    provenance,
    targetLanguage: null,
  });

  return created.skill.id;
}

/**
 * Stores the explanation as an overview lesson teaching the question skill and points the goal at
 * it, with its related questions, so the learner can read it at once; writing is done from here.
 * "Want to go further?" is linked afterwards (`linkGoFurtherCourseStep`). A new question skill is
 * created here, with the explanation's provenance, so a question nobody answered never leaves a
 * skill without its explanation behind.
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

/**
 * The subject's Overview course for "Want to go further?": the shared course with that title, or
 * a new one whose overview band is outlined in the background.
 */
export async function findGoFurtherCourseStep({
  language,
  provenance,
  title,
}: {
  language: string;
  /** The explanation run that named the course. */
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

/** The Overview course and related questions the explanation was first given, for its reuse. */
export async function findExplanationGoFurtherStep(lessonId: string) {
  "use step";

  return findExplanationGoFurther(lessonId);
}
