import { type ConnectLanguageConversationResult } from "@zoonk/core/language/conversations/connect";
import { type endLanguageConversationConnection } from "@zoonk/core/language/conversations/end-connection";
import { type redeemLiveCallSdp } from "@zoonk/core/language/conversations/redeem-sdp";
import { type StartLanguageConversationResult } from "@zoonk/core/language/conversations/start";
import { createErrorResponse, errors, httpStatus, slowDownError } from "./api-errors";
import { signUpRequiredError } from "./lesson-player-errors";
import { studySessionError } from "./study-session-errors";

type RefusedConversation =
  | Exclude<ConnectLanguageConversationResult, { status: "ready" }>
  | Exclude<Awaited<ReturnType<typeof redeemLiveCallSdp>>, { status: "ready" }>
  | Exclude<Awaited<ReturnType<typeof endLanguageConversationConnection>>, { status: "closed" }>
  | Exclude<StartLanguageConversationResult, { status: "ready" }>;

/** What a refused call says, by the call time that ran out. */
const CALL_LIMIT_MESSAGES = {
  day: "No more call time on your plan today",
  month: "No more call time on your plan this month",
  total: "Calls need a free account",
} as const;

/**
 * A live conversation that can't open now: the plan's call time for today or this month is used,
 * or a guest's plan has none (`details` names it: its period and limit in seconds), too many at
 * once, the call already ended, or it isn't the learner's.
 */
export function conversationRefusalError(
  result: RefusedConversation,
  notFoundMessage = "Conversation not found",
) {
  if (result.status === "callInProgress") {
    return createErrorResponse({
      code: "CALL_IN_PROGRESS",
      details: { connectionId: result.connectionId, conversationId: result.conversationId },
      message: "End your current call before starting another",
      status: httpStatus.conflict,
    });
  }

  if (result.status === "connectionLimitReached") {
    return createErrorResponse({
      code: "CONNECTION_LIMIT_REACHED",
      details: { period: result.period },
      message: "This call has reached its connection limit",
      status: httpStatus.tooManyRequests,
    });
  }

  if ("limit" in result) {
    return createErrorResponse({
      code: "CONVERSATION_LIMIT_REACHED",
      details: result.limit,
      message: CALL_LIMIT_MESSAGES[result.limit.period],
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

  if (result.status === "signUpRequired") {
    return signUpRequiredError();
  }

  if (
    result.status === "earlierFirst" ||
    result.status === "blockFinished" ||
    result.status === "dailyLimitReached" ||
    result.status === "questionsNeeded"
  ) {
    return studySessionError(result);
  }

  return languageError(result.status, notFoundMessage);
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

/** A checkpoint call or exam speaking task requires Plus. */
function plusRequiredError() {
  return createErrorResponse({
    code: "PLUS_REQUIRED",
    message: "This call comes with Plus",
    status: httpStatus.paymentRequired,
  });
}

type LanguageRefusal =
  | "callsPaused"
  | "connectionExpired"
  | "connectionUsed"
  | "conversationEnded"
  | "invalid"
  | "noGoal"
  | "notFound"
  | "notLanguage"
  | "plusRequired"
  | "previousConnectionClosing"
  | "retryable"
  | "takenOver"
  | "unauthorized";

/** Maps a language capability's outcome that isn't ready to the shared error envelope. */
export function languageError(status: LanguageRefusal, notFoundMessage = "Resource not found") {
  switch (status) {
    case "takenOver":
      return createErrorResponse({
        code: "CALL_TAKEN_OVER",
        message: "This call was ended when another call started.",
        status: httpStatus.conflict,
      });
    case "callsPaused":
      return createErrorResponse({
        code: "CALLS_PAUSED",
        message: "Calls are paused. Try again later.",
        status: 503,
      });
    case "retryable": {
      const response = createErrorResponse({
        code: "CALL_RETRYABLE",
        message: "The call could not connect. Try again.",
        status: 503,
      });

      response.headers.set("Retry-After", "5");
      return response;
    }
    case "previousConnectionClosing": {
      const response = createErrorResponse({
        code: "PREVIOUS_CONNECTION_CLOSING",
        message: "Your previous call is still closing. Try again shortly.",
        status: httpStatus.conflict,
      });

      response.headers.set("Retry-After", "5");
      return response;
    }
    case "connectionExpired":
      return createErrorResponse({
        code: "CONNECTION_EXPIRED",
        message: "This connection reservation expired. Reserve the call again.",
        status: httpStatus.conflict,
      });
    case "connectionUsed":
      return createErrorResponse({
        code: "CONNECTION_USED",
        message: "This connection reservation was already redeemed.",
        status: httpStatus.conflict,
      });
    case "unauthorized":
      return errors.unauthorized();
    case "notLanguage":
      return notLanguageError();
    case "conversationEnded":
      return conversationEndedError();
    case "plusRequired":
      return plusRequiredError();
    case "invalid":
      return errors.unprocessableEntity("This request can't be applied here");
    case "noGoal":
    case "notFound":
      return errors.notFound(notFoundMessage);
    default:
      return status satisfies never;
  }
}
