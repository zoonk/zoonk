import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { type ActivityGrammarUserContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-user-content";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

function nullableNonEmpty(value: string | null | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

/**
 * Builds a lookup map from each answer/distractor word to its romanization.
 * Returns null when no romanizations are available (Roman-script languages).
 */
function buildOptionRomanizations(
  options: string[],
  romanizations: Record<string, string> | null,
): Record<string, string> | null {
  if (!romanizations) {
    return null;
  }

  const entries = options
    .map((option) => [option, romanizations[option]] as const)
    .filter((entry): entry is [string, string] => Boolean(entry[1]));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * Merges the raw grammar content (TARGET_LANGUAGE examples + exercises)
 * with the user content (USER_LANGUAGE translations, rule, discovery, feedback)
 * and optional romanizations into the final step records for the database.
 *
 * The step order is: examples → discovery → rule → exercises,
 * matching the learner flow of "see pattern → test intuition → learn rule → practice."
 */
function buildGrammarSteps(
  activityId: bigint | number,
  content: ActivityGrammarContentSchema,
  userContent: ActivityGrammarUserContentSchema,
  romanizations: Record<string, string> | null,
) {
  const exampleSteps = content.examples.map((example, index) => {
    const stepContent = assertStepContent("static", {
      highlight: example.highlight,
      romanization: romanizations?.[example.sentence] ?? null,
      sentence: example.sentence,
      translation: userContent.exampleTranslations[index] ?? "",
      variant: "grammarExample",
    });

    return {
      activityId,
      content: stepContent,
      kind: "static" as const,
    };
  });

  const discoveryQuestion = nullableNonEmpty(userContent.discovery.question);
  const discoveryContext = nullableNonEmpty(userContent.discovery.context);

  const discoveryStep = {
    activityId,
    content: assertStepContent("multipleChoice", {
      ...(discoveryContext ? { context: discoveryContext } : {}),
      kind: "core",
      options: userContent.discovery.options,
      ...(discoveryQuestion ? { question: discoveryQuestion } : {}),
    }),
    kind: "multipleChoice" as const,
  };

  const ruleStep = {
    activityId,
    content: assertStepContent("static", {
      ruleName: userContent.ruleName,
      ruleSummary: userContent.ruleSummary,
      variant: "grammarRule",
    }),
    kind: "static" as const,
  };

  const practiceSteps = content.exercises.map((exercise, index) => {
    const exerciseQuestion = nullableNonEmpty(userContent.exerciseQuestions[index]);
    const fullSentence = exercise.template.replace("[BLANK]", exercise.answer);
    const allOptionKeys = [fullSentence, exercise.answer, ...exercise.distractors];
    const exerciseRomanizations = buildOptionRomanizations(allOptionKeys, romanizations);

    return {
      activityId,
      content: assertStepContent("fillBlank", {
        answers: [exercise.answer],
        distractors: exercise.distractors,
        feedback: userContent.exerciseFeedback[index] ?? "",
        ...(exerciseQuestion ? { question: exerciseQuestion } : {}),
        ...(exerciseRomanizations ? { romanizations: exerciseRomanizations } : {}),
        template: exercise.template,
      }),
      kind: "fillBlank" as const,
    };
  });

  return [...exampleSteps, discoveryStep, ruleStep, ...practiceSteps].map((step, position) => ({
    ...step,
    isPublished: true,
    position,
  }));
}

/**
 * Merges content, user content, and romanization data into grammar step records,
 * saves them to the database in a single batch insert, and marks the activity
 * as completed. This is the single save+complete point for the grammar entity.
 */
export async function saveGrammarActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  content: ActivityGrammarContentSchema,
  userContent: ActivityGrammarUserContentSchema,
  romanizations: Record<string, string> | null,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "saveGrammarActivity" });

  const steps = buildGrammarSteps(activity.id, content, userContent, romanizations);

  const { error: saveError } = await safeAsync(() => prisma.step.createMany({ data: steps }));

  if (saveError) {
    await stream.error({ reason: "dbSaveFailed", step: "saveGrammarActivity" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const { error: completeError } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (completeError) {
    await stream.error({ reason: "dbSaveFailed", step: "saveGrammarActivity" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "saveGrammarActivity" });
}
