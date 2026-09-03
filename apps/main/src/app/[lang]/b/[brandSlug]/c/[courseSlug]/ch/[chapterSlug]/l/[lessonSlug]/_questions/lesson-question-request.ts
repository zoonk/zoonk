import { type LessonQuestionContextInput } from "@zoonk/core/lesson-questions/contract";
import { type PlayerQuestionContext } from "@zoonk/player/provider";

const ANSWER_EXPLANATION_REQUEST_NAMESPACE = "zoonk:lesson-answer-explanation:v1";
const HEX_RADIX = 16;
const UUID_BYTE_LENGTH = 16;

const UUID_FORMAT_PATTERN =
  /^(?<first>.{8})(?<second>.{4}).(?<third>.{3}).(?<fourth>.{3})(?<fifth>.{12})$/u;

function getUuidFromDigest(digest: Uint8Array) {
  const hex = Array.from(digest.slice(0, UUID_BYTE_LENGTH), (byte) =>
    byte.toString(HEX_RADIX).padStart(2, "0"),
  ).join("");

  return hex.replace(UUID_FORMAT_PATTERN, "$<first>-$<second>-8$<third>-8$<fourth>-$<fifth>");
}

/**
 * Reduces the rich frozen player context to trusted references and the
 * learner's own answer. The API reconstructs course content and feedback so a
 * browser cannot inject hidden instructions or canonical answers.
 */
export function getLessonQuestionContextInput({
  context,
  lessonStepIds,
}: {
  context: PlayerQuestionContext;
  lessonStepIds: string[];
}): LessonQuestionContextInput {
  if (context.kind === "lesson") {
    return { kind: "lesson", stepIds: lessonStepIds };
  }

  if (context.kind === "step") {
    return { kind: "step", stepId: context.step.id, stepNumber: context.stepIndex + 1 };
  }

  return {
    answer: context.selectedAnswer,
    kind: "answer",
    stepId: context.step.id,
    stepNumber: context.stepIndex + 1,
  };
}

/**
 * Gives an automatic answer explanation a stable id so replaying the same
 * action reopens its durable question instead of spending another generation.
 */
export async function getAnswerExplanationRequestId({
  context,
  lessonStepIds,
  question,
}: {
  context: PlayerQuestionContext;
  lessonStepIds: string[];
  question: string;
}) {
  const request = JSON.stringify({
    context: getLessonQuestionContextInput({ context, lessonStepIds }),
    namespace: ANSWER_EXPLANATION_REQUEST_NAMESPACE,
    question,
  });

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request));
  return getUuidFromDigest(new Uint8Array(digest));
}
