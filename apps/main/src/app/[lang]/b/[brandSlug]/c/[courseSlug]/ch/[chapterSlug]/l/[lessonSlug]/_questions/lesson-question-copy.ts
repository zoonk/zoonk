import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type PlayerQuestionContext } from "@zoonk/player/provider";
import { getAnswerMaterial } from "./lesson-question-answer-copy";
import { type LessonQuestionCopyLabels } from "./lesson-question-copy-types";

type LessonQuestionCopyInput = {
  chapterTitle: string;
  context: PlayerQuestionContext;
  courseTitle: string;
  labels: LessonQuestionCopyLabels;
  lessonDescription: string;
  lessonStepLabels: string[];
  lessonSteps: SerializedStep[];
  lessonTitle: string;
  question: string;
  stepLabel: string | null;
};

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function joinValues(values: string[]): string | null {
  return values.length > 0 ? values.join(", ") : null;
}

function getStaticMaterial(step: SerializedStep): string[] {
  const content = parseStepContent("static", step.content);

  if (content.variant === "text") {
    return [content.title, content.text];
  }

  return [content.sentence, content.romanization, content.translation].filter((value) =>
    isPresent(value),
  );
}

function getFillBlankMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const content = parseStepContent("fillBlank", step.content);
  const options = joinValues(step.fillBlankOptions.map((option) => option.word));

  return [content.question, content.template, options && `${labels.options}: ${options}`].filter(
    (value) => isPresent(value),
  );
}

function getMatchColumnsMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const content = parseStepContent("matchColumns", step.content);
  const leftItems = content.pairs.map((pair) => pair.left).join(", ");
  const rightItems = step.matchColumnsRightItems.join(", ");

  return [
    content.question,
    `${labels.leftColumn}: ${leftItems}`,
    `${labels.rightColumn}: ${rightItems}`,
  ].filter((value) => isPresent(value));
}

function getMultipleChoiceMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const content = parseStepContent("multipleChoice", step.content);
  const options = joinValues(content.options.map((option) => option.text));

  return [content.context, content.question, options && `${labels.options}: ${options}`].filter(
    (value) => isPresent(value),
  );
}

function getSelectImageMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const content = parseStepContent("selectImage", step.content);
  const options = joinValues(content.options.map((option) => option.prompt));

  return [content.question, options && `${labels.options}: ${options}`].filter((value) =>
    isPresent(value),
  );
}

function getSortOrderMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const content = parseStepContent("sortOrder", step.content);
  const items = joinValues(step.sortOrderItems);

  return [content.question, items && `${labels.options}: ${items}`].filter((value) =>
    isPresent(value),
  );
}

function getTranslationMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const prompt = step.word?.translation;
  const options = joinValues(step.translationOptions.map((option) => option.word));

  return [prompt, options && `${labels.options}: ${options}`].filter((value) => isPresent(value));
}

function getReadingMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const prompt = step.sentence?.translation;
  const options = joinValues(step.wordBankOptions.map((option) => option.word));

  return [prompt, options && `${labels.options}: ${options}`].filter((value) => isPresent(value));
}

function getListeningMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  const prompt = step.sentence?.audioUrl ? labels.audioExercise : step.sentence?.sentence;
  const options = joinValues(step.wordBankOptions.map((option) => option.word));

  return [prompt, options && `${labels.options}: ${options}`].filter((value) => isPresent(value));
}

/**
 * Serializes only material the learner can currently see. The player payload
 * also contains canonical answers and feedback, so generic JSON serialization
 * would reveal exercise solutions before the learner submits an answer.
 */
function getLearnerVisibleStepMaterial({
  labels,
  step,
}: {
  labels: LessonQuestionCopyLabels;
  step: SerializedStep;
}): string[] {
  if (step.kind === "static") {
    return getStaticMaterial(step);
  }

  if (step.kind === "alphabet") {
    const content = parseStepContent("alphabet", step.content);

    return [
      content.symbol,
      content.pronunciation,
      content.readingAid,
      ...content.forms.map((form) => `${form.label}: ${form.symbol}`),
    ].filter((value) => isPresent(value));
  }

  if (step.kind === "vocabulary") {
    return [
      step.word?.word,
      step.word?.romanization,
      step.word?.pronunciation,
      step.word?.translation,
    ].filter((value) => isPresent(value));
  }

  if (step.kind === "fillBlank") {
    return getFillBlankMaterial({ labels, step });
  }

  if (step.kind === "matchColumns") {
    return getMatchColumnsMaterial({ labels, step });
  }

  if (step.kind === "multipleChoice") {
    return getMultipleChoiceMaterial({ labels, step });
  }

  if (step.kind === "selectImage") {
    return getSelectImageMaterial({ labels, step });
  }

  if (step.kind === "sortOrder") {
    return getSortOrderMaterial({ labels, step });
  }

  if (step.kind === "translation") {
    return getTranslationMaterial({ labels, step });
  }

  if (step.kind === "reading") {
    return getReadingMaterial({ labels, step });
  }

  return getListeningMaterial({ labels, step });
}

function getLessonStepSection({
  answerMaterial,
  labels,
  lessonStepLabel,
  step,
}: {
  answerMaterial: string[];
  labels: LessonQuestionCopyLabels;
  lessonStepLabel: string;
  step: SerializedStep;
}): string[] {
  return [
    "",
    `## ${lessonStepLabel}`,
    "",
    ...getLearnerVisibleStepMaterial({ labels, step }),
    ...answerMaterial,
  ];
}

function getStepSection({
  context,
  labels,
  lessonStepLabels,
  lessonSteps,
}: Pick<
  LessonQuestionCopyInput,
  "context" | "labels" | "lessonStepLabels" | "lessonSteps"
>): string[] {
  return lessonSteps.flatMap((step, index) => {
    const isCurrentStep = context.kind !== "lesson" && step.id === context.step.id;

    const answerMaterial =
      isCurrentStep && context.kind === "answer" ? getAnswerMaterial({ context, labels }) : [];

    return getLessonStepSection({
      answerMaterial,
      labels,
      lessonStepLabel: lessonStepLabels[index] ?? "",
      step,
    });
  });
}

function keepNonRepeatedBlankLine(line: string, index: number, lines: string[]) {
  return line !== "" || lines[index - 1] !== "";
}

/** Creates a readable, phase-aware prompt for learners who prefer another chatbot. */
export function buildLessonQuestionCopy({
  chapterTitle,
  context,
  courseTitle,
  labels,
  lessonDescription,
  lessonStepLabels,
  lessonSteps,
  lessonTitle,
  question,
  stepLabel,
}: LessonQuestionCopyInput): string {
  const stepSection = getStepSection({ context, labels, lessonStepLabels, lessonSteps });
  const currentStep = stepLabel ? `${labels.currentStep}: ${stepLabel}` : null;
  const questionText = question.trim() || labels.writeQuestion;

  return [
    `# ${courseTitle}`,
    "",
    `## ${chapterTitle}`,
    "",
    `### ${lessonTitle}`,
    "",
    lessonDescription,
    ...(currentStep ? ["", currentStep] : []),
    ...stepSection,
    "",
    `## ${labels.question}`,
    "",
    questionText,
  ]
    .filter((line, index, lines) => keepNonRepeatedBlankLine(line, index, lines))
    .join("\n")
    .trim();
}
