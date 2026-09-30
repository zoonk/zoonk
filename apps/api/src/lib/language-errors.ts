import { type UsageDecision } from "@zoonk/core/entitlements/contract";
import { z } from "zod";
import { createErrorResponse, errors, httpStatus, slowDownError } from "./api-errors";

type RefusedConversation =
  | Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>
  | { status: "conversationEnded" | "notFound" | "unauthorized" };

/**
 * A live conversation that can't open now: the plan's conversations for today are used, too many
 * at once, the call already ended, or it isn't the learner's.
 */
export function conversationRefusalError(result: RefusedConversation) {
  if ("limit" in result) {
    return createErrorResponse({
      code: "CONVERSATION_LIMIT_REACHED",
      details: result.limit,
      message: "No more live conversations on your plan today",
      status: httpStatus.tooManyRequests,
    });
  }

  if ("retryAfterSeconds" in result) {
    return slowDownError({
      details: result,
      message: "Too many conversations at once",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  return languageError(result.status, "Conversation not found");
}

/** A spoken answer's multipart body without its recording. */
export function missingAudioError() {
  return errors.validation(
    new z.ZodError([
      { code: "custom", message: "Send the recording as the `audio` file field", path: [] },
    ]),
  );
}

/** A recording the grader can't take: empty, too big, or not a format it reads. */
export function invalidAudioError() {
  return createErrorResponse({
    code: "INVALID_AUDIO",
    message: "Send a WebM, MP4, M4A, MP3 or WAV recording up to 2 MB",
    status: httpStatus.badRequest,
  });
}

/** A goal or unit that exists but isn't a language one. */
export function notLanguageError() {
  return createErrorResponse({
    code: "NOT_LANGUAGE",
    message: "This isn't a language goal or unit",
    status: httpStatus.unprocessableEntity,
  });
}

/** A conversation already ended: its result is final, start a new one. */
function conversationEndedError() {
  return createErrorResponse({
    code: "CONVERSATION_ENDED",
    message: "That conversation ended. Start a new one.",
    status: httpStatus.conflict,
  });
}

type LanguageRefusal =
  | "conversationEnded"
  | "invalid"
  | "noGoal"
  | "notFound"
  | "notLanguage"
  | "unauthorized";

/** Maps a language capability's outcome that isn't ready to the shared error envelope. */
export function languageError(status: LanguageRefusal, notFoundMessage = "Resource not found") {
  switch (status) {
    case "unauthorized":
      return errors.unauthorized();
    case "notLanguage":
      return notLanguageError();
    case "conversationEnded":
      return conversationEndedError();
    case "invalid":
      return errors.unprocessableEntity("This request can't be applied here");
    case "noGoal":
    case "notFound":
      return errors.notFound(notFoundMessage);
    default:
      return status satisfies never;
  }
}
