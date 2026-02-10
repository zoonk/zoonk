import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityGrammarSchema,
  generateActivityGrammar,
} from "@zoonk/ai/tasks/activities/language/grammar";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { z } from "zod";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

const minimumGrammarContentSchema = z.object({
  discovery: z.object({
    options: z.array(z.unknown()).min(1),
  }),
  examples: z.array(z.unknown()).min(1),
  exercises: z
    .array(
      z.object({
        answers: z.array(z.string()).min(1),
        feedback: z.string().trim().min(1),
        template: z.string().trim().min(1),
      }),
    )
    .min(1),
  ruleName: z.string().trim().min(1),
  ruleSummary: z.string().trim().min(1),
});

function hasMinimumGrammarContent(data: ActivityGrammarSchema): boolean {
  return minimumGrammarContentSchema.safeParse(data).success;
}

function optionalNonEmpty(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function buildGrammarSteps(activityId: bigint | number, data: ActivityGrammarSchema) {
  const exampleSteps = data.examples.map((example) => {
    const content = assertStepContent("static", {
      highlight: example.highlight,
      romanization: example.romanization,
      sentence: example.sentence,
      translation: example.translation,
      variant: "grammarExample",
    });

    return {
      activityId,
      content,
      kind: "static" as const,
    };
  });

  const discoveryQuestion = optionalNonEmpty(data.discovery.question);
  const discoveryContext = optionalNonEmpty(data.discovery.context);

  const discoveryStep = {
    activityId,
    content: assertStepContent("multipleChoice", {
      ...(discoveryContext ? { context: discoveryContext } : {}),
      options: data.discovery.options,
      ...(discoveryQuestion ? { question: discoveryQuestion } : {}),
    }),
    kind: "multipleChoice" as const,
  };

  const ruleStep = {
    activityId,
    content: assertStepContent("static", {
      ruleName: data.ruleName,
      ruleSummary: data.ruleSummary,
      variant: "grammarRule",
    }),
    kind: "static" as const,
  };

  const practiceSteps = data.exercises.map((exercise) => {
    const exerciseQuestion = optionalNonEmpty(exercise.question);

    return {
      activityId,
      content: assertStepContent("fillBlank", {
        answers: exercise.answers,
        distractors: exercise.distractors,
        feedback: exercise.feedback,
        ...(exerciseQuestion ? { question: exerciseQuestion } : {}),
        template: exercise.template,
      }),
      kind: "fillBlank" as const,
    };
  });

  return [...exampleSteps, discoveryStep, ruleStep, ...practiceSteps].map((step, position) => ({
    ...step,
    position,
  }));
}

async function handleGrammarError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<void> {
  await streamError({ reason, step: "generateGrammarContent" });
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
    const reason = getAIResultErrorReason(error, result);
    await handleGrammarError(activity.id, reason);
    return { generated: false };
  }

  const { error: saveError } = await saveGrammarSteps(activity.id, result.data);

  if (saveError) {
    await handleGrammarError(activity.id, "dbSaveFailed");
    return { generated: false };
  }

  await streamStatus({ status: "completed", step: "generateGrammarContent" });
  return { generated: true };
}
