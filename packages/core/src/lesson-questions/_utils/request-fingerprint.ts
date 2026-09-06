import "server-only";
import { createHash } from "node:crypto";
import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import { type CreateLessonQuestionInput, type LessonQuestionContextInput } from "../contract";

const REQUEST_FINGERPRINT_VERSION = 1;

function getAnswerFingerprint(answer: SelectedAnswer): unknown[] {
  switch (answer.kind) {
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
    case "selectImage":
    case "translation":
      return [answer.kind, answer.selectedOptionId];
    case "sortOrder":
      return [answer.kind, answer.userOrder];
    default:
      return answer satisfies never;
  }
}

function getContextFingerprint(context: LessonQuestionContextInput): unknown[] {
  if (context.kind === "lesson") {
    return [context.kind, context.stepIds ?? []];
  }

  if (context.kind === "step") {
    return [context.kind, context.stepId, context.stepNumber];
  }

  return [context.kind, context.stepId, context.stepNumber, getAnswerFingerprint(context.answer)];
}

/**
 * Idempotency compares only the normalized client request. Authoritative curriculum snapshots may
 * change after the first commit, but replaying that request must continue to resolve its original turn.
 */
export function getLessonQuestionRequestFingerprint(input: CreateLessonQuestionInput): string {
  const normalizedRequest = [
    REQUEST_FINGERPRINT_VERSION,
    input.question,
    getContextFingerprint(input.context),
  ];

  return createHash("sha256").update(JSON.stringify(normalizedRequest)).digest("hex");
}
