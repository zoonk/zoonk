import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type PlayerQuestionContext } from "@zoonk/player/provider";
import { type LessonQuestionCopyLabels } from "./lesson-question-copy-types";

function fillBlankAnswer({ answers, step }: { answers: string[]; step: SerializedStep }): string {
  const content = parseStepContent("fillBlank", step.content);
  const segments = content.template.split("[BLANK]");

  return segments.map((segment, index) => `${segment}${answers[index] ?? ""}`).join("");
}

function getSelectedAnswerText(context: Extract<PlayerQuestionContext, { kind: "answer" }>) {
  const { selectedAnswer, step } = context;

  if (selectedAnswer.kind === "multipleChoice" && step.kind === "multipleChoice") {
    return parseStepContent("multipleChoice", step.content).options.find(
      (option) => option.id === selectedAnswer.selectedOptionId,
    )?.text;
  }

  if (selectedAnswer.kind === "selectImage" && step.kind === "selectImage") {
    return parseStepContent("selectImage", step.content).options.find(
      (option) => option.id === selectedAnswer.selectedOptionId,
    )?.prompt;
  }

  if (selectedAnswer.kind === "translation") {
    return step.translationOptions.find((option) => option.id === selectedAnswer.selectedOptionId)
      ?.word;
  }

  if (selectedAnswer.kind === "fillBlank" && step.kind === "fillBlank") {
    return fillBlankAnswer({ answers: selectedAnswer.userAnswers, step });
  }

  if (selectedAnswer.kind === "reading" || selectedAnswer.kind === "listening") {
    return selectedAnswer.arrangedWords.join(" ");
  }

  if (selectedAnswer.kind === "sortOrder") {
    return selectedAnswer.userOrder.join(" ");
  }

  if (selectedAnswer.kind === "matchColumns") {
    return selectedAnswer.userPairs.map((pair) => `${pair.left} ↔ ${pair.right}`).join(", ");
  }

  return null;
}

function getDerivedCorrectAnswer(context: Extract<PlayerQuestionContext, { kind: "answer" }>) {
  if (context.result.result.correctAnswer) {
    return context.result.result.correctAnswer;
  }

  if (context.step.kind === "selectImage") {
    return parseStepContent("selectImage", context.step.content).options.find(
      (option) => option.isCorrect,
    )?.prompt;
  }

  if (context.step.kind === "sortOrder") {
    return parseStepContent("sortOrder", context.step.content).items.join(" ");
  }

  if (context.step.kind === "reading") {
    return context.step.sentence?.sentence;
  }

  if (context.step.kind === "listening") {
    return context.step.sentence?.translation;
  }

  return null;
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function getAnswerMaterial({
  context,
  labels,
}: {
  context: Extract<PlayerQuestionContext, { kind: "answer" }>;
  labels: LessonQuestionCopyLabels;
}): string[] {
  const selectedAnswer = getSelectedAnswerText(context);
  const correctAnswer = getDerivedCorrectAnswer(context);
  const feedback = context.result.result.feedback;

  return [
    selectedAnswer && `${labels.yourAnswer}: ${selectedAnswer}`,
    correctAnswer && `${labels.correctAnswer}: ${correctAnswer}`,
    feedback && `${labels.feedback}: ${feedback}`,
  ].filter((value) => isPresent(value));
}
