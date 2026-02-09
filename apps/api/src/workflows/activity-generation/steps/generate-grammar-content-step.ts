import {
  type ActivityGrammarSchema,
  generateActivityGrammar,
} from "@zoonk/ai/tasks/activities/language/grammar";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

function hasMinimumGrammarContent(data: ActivityGrammarSchema): boolean {
  return (
    data.examples.length > 0 &&
    data.discovery.options.length > 0 &&
    data.discovery.context.trim().length > 0 &&
    data.discovery.question.trim().length > 0 &&
    data.exercises.length > 0 &&
    data.exercises.every(
      (exercise) =>
        exercise.answers.length > 0 &&
        exercise.question.trim().length > 0 &&
        exercise.template.trim().length > 0,
    )
  );
}

function buildGrammarSteps(activityId: bigint | number, data: ActivityGrammarSchema) {
  const exampleSteps = data.examples.map((example) => ({
    activityId,
    content: {
      highlight: example.highlight,
      romanization: example.romanization,
      section: "examples",
      sentence: example.sentence,
      translation: example.translation,
    },
    kind: "static" as const,
  }));

  const discoveryStep = {
    activityId,
    content: {
      context: data.discovery.context,
      options: data.discovery.options,
      question: data.discovery.question,
    },
    kind: "multipleChoice" as const,
  };

  const ruleStep = {
    activityId,
    content: {
      ruleName: data.ruleName,
      ruleSummary: data.ruleSummary,
      section: "rule",
    },
    kind: "static" as const,
  };

  const practiceSteps = data.exercises.map((exercise) => ({
    activityId,
    content: {
      answers: exercise.answers,
      distractors: exercise.distractors,
      feedback: exercise.feedback,
      question: exercise.question,
      template: exercise.template,
    },
    kind: "fillBlank" as const,
  }));

  return [...exampleSteps, discoveryStep, ruleStep, ...practiceSteps].map((step, position) => ({
    ...step,
    position,
  }));
}

async function handleGrammarError(activityId: bigint | number): Promise<void> {
  await streamStatus({ status: "error", step: "generateGrammarContent" });
  await handleActivityFailureStep({ activityId });
}

async function saveGrammarSteps(
  activityId: bigint | number,
  data: ActivityGrammarSchema,
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: buildGrammarSteps(activityId, data),
    }),
  );
}

export async function generateGrammarContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ generated: boolean }> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return { generated: false };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { generated: false };
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  await streamStatus({ status: "started", step: "generateGrammarContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityGrammarSchema }> = await safeAsync(() =>
    generateActivityGrammar({
      chapterTitle: activity.lesson.chapter.title,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      targetLanguage:
        activity.lesson.chapter.course.targetLanguage ?? activity.lesson.chapter.course.title,
      userLanguage: activity.language,
    }),
  );

  if (error || !result || !hasMinimumGrammarContent(result.data)) {
    await handleGrammarError(activity.id);
    return { generated: false };
  }

  const { error: saveError } = await saveGrammarSteps(activity.id, result.data);

  if (saveError) {
    await handleGrammarError(activity.id);
    return { generated: false };
  }

  await streamStatus({ status: "completed", step: "generateGrammarContent" });
  return { generated: true };
}
