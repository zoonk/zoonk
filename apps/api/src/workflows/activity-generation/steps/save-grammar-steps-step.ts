import { type ActivityGrammarContentSchema } from "@zoonk/ai/tasks/activities/language/grammar-content";
import { type ActivityGrammarEnrichmentSchema } from "@zoonk/ai/tasks/activities/language/grammar-enrichment";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
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
 * Merges the raw grammar content (TARGET_LANGUAGE examples + exercises)
 * with the enrichment data (USER_LANGUAGE translations, rule, discovery, feedback)
 * and optional romanizations into the final step records for the database.
 *
 * The step order is: examples → discovery → rule → exercises,
 * matching the learner flow of "see pattern → test intuition → learn rule → practice."
 */
function buildGrammarSteps(
  activityId: bigint | number,
  content: ActivityGrammarContentSchema,
  enrichment: ActivityGrammarEnrichmentSchema,
  romanizations: Record<string, string> | null,
) {
  const exampleSteps = content.examples.map((example, index) => {
    const stepContent = assertStepContent("static", {
      highlight: example.highlight,
      romanization: romanizations?.[example.sentence] ?? null,
      sentence: example.sentence,
      translation: enrichment.exampleTranslations[index] ?? "",
      variant: "grammarExample",
    });

    return {
      activityId,
      content: stepContent,
      kind: "static" as const,
    };
  });

  const discoveryQuestion = nullableNonEmpty(enrichment.discovery.question);
  const discoveryContext = nullableNonEmpty(enrichment.discovery.context);

  const discoveryStep = {
    activityId,
    content: assertStepContent("multipleChoice", {
      ...(discoveryContext ? { context: discoveryContext } : {}),
      kind: "core",
      options: enrichment.discovery.options,
      ...(discoveryQuestion ? { question: discoveryQuestion } : {}),
    }),
    kind: "multipleChoice" as const,
  };

  const ruleStep = {
    activityId,
    content: assertStepContent("static", {
      ruleName: enrichment.ruleName,
      ruleSummary: enrichment.ruleSummary,
      variant: "grammarRule",
    }),
    kind: "static" as const,
  };

  const practiceSteps = content.exercises.map((exercise, index) => {
    const exerciseQuestion = nullableNonEmpty(enrichment.exerciseQuestions[index]);

    return {
      activityId,
      content: assertStepContent("fillBlank", {
        answers: exercise.answers,
        distractors: exercise.distractors,
        feedback: enrichment.exerciseFeedback[index] ?? "",
        ...(exerciseQuestion ? { question: exerciseQuestion } : {}),
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
 * Merges content, enrichment, and romanization data into grammar step records
 * and saves them to the database in a single batch insert.
 * This is the final step of the grammar workflow before marking the activity as completed.
 */
export async function saveGrammarStepsStep(
  activities: LessonActivity[],
  workflowRunId: string,
  content: ActivityGrammarContentSchema,
  enrichment: ActivityGrammarEnrichmentSchema,
  romanizations: Record<string, string> | null,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "grammar");

  if (!activity) {
    return;
  }

  await streamStatus({ status: "started", step: "saveGrammarSteps" });

  const steps = buildGrammarSteps(activity.id, content, enrichment, romanizations);

  const { error } = await safeAsync(() => prisma.step.createMany({ data: steps }));

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "saveGrammarSteps" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "completed", step: "saveGrammarSteps" });
}
