import "server-only";
import { createHash } from "node:crypto";
import { type CreateLessonQuestionInput, type LessonQuestionContextInput } from "../contract";

const REQUEST_FINGERPRINT_VERSION = 1;

type LessonQuestionAnswer = Extract<LessonQuestionContextInput, { kind: "answer" }>["answer"];

function getAnswerFingerprint(answer: LessonQuestionAnswer): unknown[] {
  switch (answer.kind) {
    case "activity":
      return [answer.kind, answer.answer];
    case "challenge":
      return [answer.kind, answer.choiceIds];
    case "check":
      return [answer.kind, answer.optionId];
    case "spokenAnswer":
    case "typedAnswer":
      return [answer.kind, answer.text];
    case "fillBlank":
      return [answer.kind, answer.userAnswers];
    case "listening":
    case "reading":
      return [answer.kind, answer.arrangedWords];
    case "matchColumns":
      return [
        answer.kind,
        answer.mistakes,
        answer.userPairs.map((pair) => [pair.left, pair.right]),
      ];
    case "multipleChoice":
    case "translation":
      return [answer.kind, answer.selectedOptionId];
    default:
      return answer satisfies never;
  }
}

function getContextFingerprint(context: LessonQuestionContextInput): unknown[] {
  switch (context.kind) {
    case "answer":
      return [
        context.kind,
        context.stepId,
        context.stepNumber,
        getAnswerFingerprint(context.answer),
      ];
    case "lesson":
      return [context.kind, context.stepIds ?? []];
    case "step":
      return [context.kind, context.stepId, context.stepNumber];
    case "chapter":
    case "mock":
    case "plan":
      return [context.kind];
    default:
      return context satisfies never;
  }
}

/**
 * Idempotency compares only the normalized client request. Authoritative curriculum snapshots may
 * change after the first commit, but replaying that request must continue to resolve its original turn.
 * A suggested question adds a marker, so requests without one keep their fingerprints.
 */
export function getLessonQuestionRequestFingerprint(
  input: Omit<CreateLessonQuestionInput, "requestId">,
): string {
  const normalizedRequest = [
    REQUEST_FINGERPRINT_VERSION,
    input.question,
    getContextFingerprint(input.context),
    ...(input.suggested ? ["suggested"] : []),
  ];

  return createHash("sha256").update(JSON.stringify(normalizedRequest)).digest("hex");
}

/**
 * Whether a question about a lesson screen was one of the tutor's suggestions, sent as offered.
 * The request said so when it created the question, and its stored fingerprint keeps that.
 */
export function isSuggestedScreenQuestion(question: {
  libraryStepId: string | null;
  question: string;
  requestFingerprint: string;
  stepNumber: number | null;
}): boolean {
  if (!question.libraryStepId || !question.stepNumber) {
    return false;
  }

  const suggestedFingerprint = getLessonQuestionRequestFingerprint({
    context: { kind: "step", stepId: question.libraryStepId, stepNumber: question.stepNumber },
    question: question.question,
    suggested: true,
  });

  return question.requestFingerprint === suggestedFingerprint;
}
