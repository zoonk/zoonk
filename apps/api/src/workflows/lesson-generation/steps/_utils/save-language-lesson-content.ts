import { type LessonGrammarSchema } from "@zoonk/ai/tasks/lessons/language/grammar";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type TransactionClient } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { type GrammarLessonContent } from "./generated-lesson-content";
import { type StepRecord, getOptionalQuestion } from "./save-lesson-content-helpers";

/**
 * Saves the explanation-first grammar flow: explanations, examples, then practice.
 */
export async function saveGrammarLessonContent({
  content,
  context,
  romanizations = null,
  transaction,
}: {
  content: GrammarLessonContent;
  context: LessonContext;
  romanizations?: Record<string, string> | null;
  transaction: TransactionClient;
}): Promise<void> {
  await transaction.step.createMany({
    data: buildGrammarSteps({ content: content.grammarContent, context, romanizations }),
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
 * Builds ordered grammar step records from the combined grammar content.
 */
function buildGrammarSteps({
  content,
  context,
  romanizations,
}: {
  content: LessonGrammarSchema;
  context: LessonContext;
  romanizations: Record<string, string> | null;
}): StepRecord[] {
  const explanationSteps = content.explanations.map((explanation) => ({
    content: assertStepContent("static", {
      text: explanation.text,
      title: explanation.title,
      variant: "text",
    }),
    isPublished: true,
    kind: "static" as const,
    lessonId: context.id,
  }));

  const exampleSteps = content.examples.map((example) => ({
    content: assertStepContent("static", {
      highlight: example.highlight,
      romanization: romanizations?.[example.sentence] ?? null,
      sentence: example.sentence,
      translation: example.translation,
      variant: "grammarExample",
    }),
    isPublished: true,
    kind: "static" as const,
    lessonId: context.id,
  }));

  const questionSteps = content.questions.map((question) => {
    const fullSentence = question.template.replace("[BLANK]", question.answer);

    const optionRomanizations = buildOptionRomanizations(
      [fullSentence, question.answer, ...question.distractors],
      romanizations,
    );

    return {
      content: assertStepContent("fillBlank", {
        answers: [question.answer],
        distractors: question.distractors,
        feedback: question.feedback,
        ...(optionRomanizations ? { romanizations: optionRomanizations } : {}),
        ...getOptionalQuestion(question.question),
        template: question.template,
      }),
      isPublished: true,
      kind: "fillBlank" as const,
      lessonId: context.id,
    };
  });

  return [...explanationSteps, ...exampleSteps, ...questionSteps].map((step, position) => ({
    ...step,
    position,
  }));
}
