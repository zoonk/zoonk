import { type LessonGrammarContentSchema } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type LessonGrammarUserContentSchema } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { type GrammarLessonContent } from "./generated-lesson-content";
import {
  type StepRecord,
  addOptionIds,
  getOptionalContext,
  getOptionalQuestion,
} from "./save-lesson-content-helpers";

/**
 * Saves the grammar discovery flow: examples, discovery question, rule, then practice.
 */
export async function saveGrammarLessonContent({
  content,
  context,
  romanizations = null,
}: {
  content: GrammarLessonContent;
  context: LessonContext;
  romanizations?: Record<string, string> | null;
}): Promise<void> {
  await prisma.step.createMany({
    data: buildGrammarSteps({
      content: content.grammarContent,
      context,
      romanizations,
      userContent: content.userContent,
    }),
  });
}

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
 * Builds ordered grammar step records from target-language and user-language content.
 */
function buildGrammarSteps({
  content,
  context,
  romanizations,
  userContent,
}: {
  content: LessonGrammarContentSchema;
  context: LessonContext;
  romanizations: Record<string, string> | null;
  userContent: LessonGrammarUserContentSchema;
}): StepRecord[] {
  const exampleSteps = content.examples.map((example, index) => ({
    content: assertStepContent("static", {
      highlight: example.highlight,
      romanization: romanizations?.[example.sentence] ?? null,
      sentence: example.sentence,
      translation: userContent.exampleTranslations[index] ?? "",
      variant: "grammarExample",
    }),
    isPublished: true,
    kind: "static" as const,
    lessonId: context.id,
  }));

  const discoveryStep = {
    content: assertStepContent("multipleChoice", {
      ...getOptionalQuestion(userContent.discovery.question),
      ...getOptionalContext(userContent.discovery.context),
      kind: "core",
      options: addOptionIds({ options: userContent.discovery.options }),
    }),
    isPublished: true,
    kind: "multipleChoice" as const,
    lessonId: context.id,
  };

  const ruleStep = {
    content: assertStepContent("static", {
      ruleName: userContent.ruleName,
      ruleSummary: userContent.ruleSummary,
      variant: "grammarRule",
    }),
    isPublished: true,
    kind: "static" as const,
    lessonId: context.id,
  };

  const exerciseSteps = content.exercises.map((exercise, index) => {
    const fullSentence = exercise.template.replace("[BLANK]", exercise.answer);
    const optionRomanizations = buildOptionRomanizations(
      [fullSentence, exercise.answer, ...exercise.distractors],
      romanizations,
    );

    return {
      content: assertStepContent("fillBlank", {
        answers: [exercise.answer],
        distractors: exercise.distractors,
        feedback: userContent.exerciseFeedback[index] ?? "",
        ...(optionRomanizations ? { romanizations: optionRomanizations } : {}),
        ...getOptionalQuestion(userContent.exerciseQuestions[index]),
        template: exercise.template,
      }),
      isPublished: true,
      kind: "fillBlank" as const,
      lessonId: context.id,
    };
  });

  return [...exampleSteps, discoveryStep, ruleStep, ...exerciseSteps].map((step, position) => ({
    ...step,
    position,
  }));
}
