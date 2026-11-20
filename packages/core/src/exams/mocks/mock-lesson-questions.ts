import { type RecallQuestion } from "@zoonk/ai/tasks/items/check-recall-overlap";
import { type StepKind } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";

type LessonScreen = {
  kind: StepKind;
  content: unknown;
  wordId: string | null;
  sentenceId: string | null;
  lesson: {
    sentences: { sentence: { id: string; sentence: string }; translation: string }[];
    words: { word: { id: string; word: string }; translation: string }[];
  };
};

function lines(values: readonly unknown[]) {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((part): part is string => typeof part === "string")
    : [];
}

function lessonContentQuestion(content: Record<string, unknown>): RecallQuestion | null {
  const check = isJsonObject(content.check) ? content.check : content;
  const options = Array.isArray(check.options) ? check.options.filter(isJsonObject) : [];
  const pairs = Array.isArray(content.pairs) ? content.pairs.filter(isJsonObject) : [];

  const question = lines([
    content.context,
    content.prompt,
    check.question,
    content.template,
    content.problem,
    ...pairs.map((pair) => pair.left),
    ...options.map((option) => typeof option.text === "string" && `- ${option.text}`),
    ...strings(content.distractors),
  ]);

  if (!question) {
    return null;
  }

  const numeric =
    typeof check.answer === "number"
      ? [String(check.answer), getString(check, "unit")].filter(Boolean).join(" ")
      : null;

  const answer = lines([
    getString(content, "sampleAnswer") ??
      getString(content, "targetText") ??
      getString(content, "result") ??
      numeric,
    ...strings(content.answers),
    ...options.filter((option) => option.isCorrect === true).map((option) => option.text),
    ...pairs.map((pair) =>
      [getString(pair, "left"), getString(pair, "right")].filter(Boolean).join(" = "),
    ),
    check.kind === "interaction" && check.explanation,
  ]);

  return { answer: answer || null, question };
}

export function readLessonRecallQuestions(step: LessonScreen): RecallQuestion[] {
  if (step.kind === "reading" || step.kind === "listening") {
    const row = step.lesson.sentences.find((entry) => entry.sentence.id === step.sentenceId);

    if (!row) {
      return [];
    }

    return step.kind === "listening"
      ? [{ answer: row.translation, question: row.sentence.sentence }]
      : [{ answer: row.sentence.sentence, question: row.translation }];
  }

  if (step.kind === "translation") {
    const row = step.lesson.words.find((entry) => entry.word.id === step.wordId);
    return row ? [{ answer: row.word.word, question: row.translation }] : [];
  }

  const question = isJsonObject(step.content) && lessonContentQuestion(step.content);
  return question ? [question] : [];
}
