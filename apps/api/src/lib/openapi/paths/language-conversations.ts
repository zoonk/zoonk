import {
  completedLanguageConversationSchema,
  languageConversationCompletionInputSchema,
  languageConversationConnectInputSchema,
  languageConversationObjectiveCheckInputSchema,
  languageConversationObjectiveCheckSchema,
  languageConversationSetupSchema,
  languageConversationStartInputSchema,
  languageConversationViewSchema,
  liveCallSdpInputSchema,
  liveCallSdpResponseSchema,
} from "@zoonk/core/language/conversations/contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import {
  languageConversationConnectionPathParamsSchema,
  languageConversationCreatedSchema,
  languageConversationPathParamsSchema,
  liveCallEndResponseSchema,
} from "../schemas/language";
import {
  conflictResponse,
  forbiddenResponse,
  jsonResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
  "422": unprocessableEntityResponse,
};

const common = { security: AUTHENTICATED_SECURITY, tags: ["Language"] };

const callUnavailableResponse = {
  ...conflictResponse,
  description:
    "Calls are paused (CALLS_PAUSED) or deadline dispatch/provider creation failed (CALL_RETRYABLE; retry after Retry-After). No usable SDP is returned.",
};

const connectionConflictResponse = {
  ...conflictResponse,
  description:
    "The call ended or its originating connection was replaced (CONVERSATION_ENDED; current connection is unaffected), was taken over (CALL_TAKEN_OVER; no feedback or reward), another call is in progress (CALL_IN_PROGRESS with its conversationId and connectionId; reserve with takeover: true to end it), the previous connection is still closing (PREVIOUS_CONNECTION_CLOSING; retry after Retry-After), or this reservation expired/already redeemed (CONNECTION_EXPIRED / CONNECTION_USED).",
};

/** Live conversations: start one, read it, connect to GPT-Live, mark its goals, finish it. */
export const languageConversationPaths = {
  "/language-conversations": {
    post: {
      ...common,
      description:
        "Starts a live conversation: practice for a unit (1 to 5 minutes), a language goal's Plus-only phase/final checkpoint call (its length set by the learner's level; 402 PLUS_REQUIRED for Free or lapsed learners), a speaking mock of the exam the goal prepares for (IELTS or TOEFL iBT), or one task of a DELE, DELF or DALF, Goethe-Zertifikat or Cambridge English speaking paper (kind examSpeaking, Plus only: 402 PLUS_REQUIRED otherwise), with a new card each time and the call as long as the task's official time; a task whose shortest official time doesn't fit the call time left today or this month is refused with 429 CONVERSATION_LIMIT_REACHED (`details` names the period) before any card is written. A checkpoint call starts or resumes its study block first; unfinished earlier lessons or phase challenges refuse it before any scenario is written or existing call returned. The character speaks at the learner's speaking level, an exam's examiner or partner at the exam's. Nothing is charged until the call connects.",
      operationId: "startLanguageConversation",
      requestBody: {
        content: { "application/json": { schema: languageConversationStartInputSchema } },
        required: true,
      },
      responses: {
        "201": jsonResponse(languageConversationCreatedSchema, "The new conversation"),
        "402": {
          ...paymentRequiredResponse,
          description:
            "A language phase/final checkpoint call or an exam speaking task requires Plus. Error code: PLUS_REQUIRED. Practice calls keep their existing plan allowances.",
        },
        "403": {
          ...forbiddenResponse,
          description: `Today's study time limit is reached. Error code: ${studySessionErrorCodes.dailyLimitReached}.`,
        },
        "409": {
          ...conflictResponse,
          description: `A checkpoint block is finished (${studySessionErrorCodes.blockFinished}), or it waits for earlier work in the same session (${studySessionErrorCodes.earlierFirst}, with details.reason \`lessons\` or \`challenge\`; finish or skip that work, then start again).`,
        },
        "429": tooManyRequestsResponse,
        "503": {
          ...callUnavailableResponse,
          description:
            "Exam speaking tasks and IELTS/TOEFL speaking mocks are refused before generation when calls are paused. Error code: CALLS_PAUSED.",
        },
        ...readErrors,
      },
      summary: "Start a live conversation",
    },
  },
  "/language-conversations/{conversationId}": {
    get: {
      ...common,
      description:
        "A live conversation: the character, the call's goals with the ones met, hints, and the instructions for the voice model while it can still be made; after the call, the result with the feedback.",
      operationId: "getLanguageConversation",
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "200": jsonResponse(languageConversationViewSchema, "The conversation"),
        ...readErrors,
      },
      summary: "Get a live conversation",
    },
  },
  "/language-conversations/{conversationId}/completions": {
    post: {
      ...common,
      description:
        "Requires the originating connectionId and closes only that provider connection before writing feedback or rewards, then finishes the call with its transcript, help used and time spoken. Browser voiceSeconds is informational; provider cost comes from the server connection ledger. The goals met are those marked during the call plus any the full transcript shows; a separate model writes feedback; a won checkpoint closes the unit. The response also says what the call did to the day's missions (`missionMoment`, null when it completed none). Repeating it returns the same result. A takeover cannot award feedback to the old call. Completion from a superseded connection returns CONVERSATION_ENDED and cannot close the current connection or write feedback.",
      operationId: "completeLanguageConversation",
      requestBody: {
        content: { "application/json": { schema: languageConversationCompletionInputSchema } },
        required: true,
      },
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "200": jsonResponse(completedLanguageConversationSchema, "The finished conversation"),
        "409": connectionConflictResponse,
        ...readErrors,
      },
      summary: "Finish a live conversation",
    },
  },
  "/language-conversations/{conversationId}/connections": {
    post: {
      ...common,
      description:
        "Reserves one live-call connection after fresh authorization, admission and Plus checks. Atomically holds learner call time and dollar exposure, then stores a durable Workflow deadline receipt before returning. No provider session or credential is created here. POST the browser's SDP offer to sessionUrl; its server owns the model, instructions, voice and event permissions. deadlineAt is absolute, including goodbye/drain time; setup delay never restarts the clock. requestId makes retries reuse the same reservation; takeover explicitly ends another call first. Reconnect waits for confirmed closure. Practice can start over; Plus checkpoint reconnects share the original deadline. Calls may be shortened by the day/month allowance. Dollar budgets and per-conversation/day attempt caps also apply.",
      operationId: "connectLanguageConversation",
      requestBody: {
        content: { "application/json": { schema: languageConversationConnectInputSchema } },
        required: false,
      },
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "201": jsonResponse(languageConversationSetupSchema, "How to connect"),
        "402": {
          ...paymentRequiredResponse,
          description:
            "The checkpoint call or exam speaking task requires Plus, including after lapse. Error code: PLUS_REQUIRED. No reservation or provider session is created.",
        },
        "403": {
          ...forbiddenResponse,
          description: `Today's study time limit is reached before the checkpoint block starts. Error code: ${studySessionErrorCodes.dailyLimitReached}.`,
        },
        "409": {
          ...conflictResponse,
          description: `The call ended, its checkpoint block is finished (${studySessionErrorCodes.blockFinished}), or the checkpoint waits for earlier work (${studySessionErrorCodes.earlierFirst}, with details.reason \`lessons\` or \`challenge\`). No usage is claimed while waiting. CALL_IN_PROGRESS returns the existing call IDs; PREVIOUS_CONNECTION_CLOSING asks for a retry after confirmed closure.`,
        },
        "429": {
          ...tooManyRequestsResponse,
          description:
            "Call time or dollar budget is exhausted (CONVERSATION_LIMIT_REACHED with details.period), or attempts are exhausted (CONNECTION_LIMIT_REACHED with details.period day/conversation).",
        },
        "503": callUnavailableResponse,
        ...readErrors,
      },
      summary: "Reserve a live conversation connection",
    },
  },
  "/language-conversations/{conversationId}/connections/{connectionId}/end": {
    post: {
      ...common,
      description:
        "Closes the owned provider connection before the client drops its peer. Stop microphone and playback immediately, await this terminal result, then close the peer. No feedback or reward is written here. Repeating a confirmed End is safe. Unconfirmed closure returns PREVIOUS_CONNECTION_CLOSING and retains the slot and liability while the original deadline run retries.",
      operationId: "endLanguageConversationConnection",
      requestParams: { path: languageConversationConnectionPathParamsSchema },
      responses: {
        "200": jsonResponse(liveCallEndResponseSchema, "Provider connection closed"),
        "409": connectionConflictResponse,
        ...readErrors,
      },
      summary: "End a live conversation connection",
    },
  },
  "/language-conversations/{conversationId}/connections/{connectionId}/sdp": {
    post: {
      ...common,
      description:
        "Redeems the owned reservation once for a server-created GPT-Live WebRTC session. Rechecks admission, Plus and the absolute deadline and requires a persisted Workflow receipt. Browser sessionConfig is ignored. An offer without the lines of a WebRTC audio offer is refused (400) before any provider work. When the provider refuses to create the session, the reservation is released at once (CALL_RETRYABLE): reserve again. Apply the returned SDP answer to the peer; do not send session.start. Audio uses WebRTC media tracks. No provider key or token is returned.",
      operationId: "redeemLanguageConversationSdp",
      requestBody: {
        content: { "application/json": { schema: liveCallSdpInputSchema } },
        required: true,
      },
      requestParams: { path: languageConversationConnectionPathParamsSchema },
      responses: {
        "201": jsonResponse(liveCallSdpResponseSchema, "The WebRTC SDP answer and session ID"),
        "402": paymentRequiredResponse,
        "409": connectionConflictResponse,
        "503": callUnavailableResponse,
        ...readErrors,
      },
      summary: "Exchange a live conversation SDP offer",
    },
  },
  "/language-conversations/{conversationId}/objective-checks": {
    post: {
      ...common,
      description:
        "Marks the call's goals while the learner talks: send what was said so far after each of the learner's turns. A separate model reads it and says which goals the learner's own words achieved; they stay met for the rest of the call. Only for a connected call that is still running.",
      operationId: "checkLanguageConversationObjectives",
      requestBody: {
        content: { "application/json": { schema: languageConversationObjectiveCheckInputSchema } },
        required: true,
      },
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "200": jsonResponse(languageConversationObjectiveCheckSchema, "Every goal met so far"),
        "409": conflictResponse,
        ...readErrors,
      },
      summary: "Check a live conversation's goals",
    },
  },
};
