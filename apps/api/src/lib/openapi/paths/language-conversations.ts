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
    "Calls are paused (CALLS_PAUSED) or the deadline run or provider creation failed (CALL_RETRYABLE; retry after Retry-After). No usable SDP is returned.",
};

const connectionConflictResponse = {
  ...conflictResponse,
  description:
    "The call ended or its originating connection was replaced (CONVERSATION_ENDED; current connection is unaffected), was taken over (CALL_TAKEN_OVER; no feedback or reward), another call is in progress (CALL_IN_PROGRESS with its conversationId and connectionId; reserve with takeover: true to end it), a connection is still ending or its review is in progress (PREVIOUS_CONNECTION_CLOSING; retry after Retry-After), or this reservation expired/already redeemed (CONNECTION_EXPIRED / CONNECTION_USED).",
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
        "A live conversation: the character, the call's goals with the ones met and hints; after the call, the result with the feedback. The voice model's instructions stay on the server, which sends them when it creates the session.",
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
        "Requires the originating connectionId. Claims the call's review, so it takes no new connections, hangs that connection up, then finishes the call with its transcript, help used and time spoken. The goals met are those marked during the call plus any the full transcript shows; a separate model writes feedback; a won checkpoint closes the unit. The response also says what the call did to the day's missions (`missionMoment`, null when it completed none). Repeating it returns the same result. A takeover cannot award feedback to the old call (CALL_TAKEN_OVER). Completion from a superseded connection returns CONVERSATION_ENDED and cannot end the current connection or write feedback.",
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
        "Reserves one live-call connection after fresh authorization, admission and Plus checks. Holds the learner's call time and its cost, and starts the run that hangs the call up at deadlineAt (the reservation plus the time held, with no grace) before returning. No provider session or credential is created here. POST the browser's SDP offer to sessionUrl within a minute; its server owns the model, instructions, voice and event permissions. `seconds` is the time left when the server answered: end the call that long after the answer arrives. The learner's open connection ends first: a reservation always, a live connection of the same call as a reconnect (charged up to that moment), and another call's only with takeover. A session still being created or a hangup OpenAI didn't confirm answers PREVIOUS_CONNECTION_CLOSING. Practice can start over; checkpoint reconnects share the original deadline. Calls may be shortened by the day/month allowance. Dollar budgets and a daily connection cap also apply.",
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
          description: `The call ended, its checkpoint block is finished (${studySessionErrorCodes.blockFinished}), or the checkpoint waits for earlier work (${studySessionErrorCodes.earlierFirst}, with details.reason \`lessons\` or \`challenge\`). No usage is claimed while waiting. CALL_IN_PROGRESS returns the existing call IDs; PREVIOUS_CONNECTION_CLOSING asks for a retry once the previous connection ended.`,
        },
        "429": {
          ...tooManyRequestsResponse,
          description:
            "Call time or dollar budget is exhausted (CONVERSATION_LIMIT_REACHED with details.period), or the day's connections are used (CONNECTION_LIMIT_REACHED with details.period day).",
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
        "Hangs up the owned connection's session and settles the call at that moment: the learner keeps only the time it ran. Stop microphone and playback immediately; the peer closes once the session ends. No feedback or reward is written here. Repeating it is safe. A hangup OpenAI didn't confirm, or a session still being created, returns PREVIOUS_CONNECTION_CLOSING: ask again; the deadline run also ends it.",
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
        "Redeems the owned reservation once, within a minute of reserving it, for a server-created GPT-Live WebRTC session. Rechecks admission and Plus. A reservation past its minute, or one a newer start ended, returns CONNECTION_EXPIRED. Browser sessionConfig is ignored. An offer without the lines of a WebRTC audio offer is refused (400) before any provider work. When creation fails (CALL_RETRYABLE), the reservation ends: reserve again. A session that's no longer wanted when it exists (the call was ended, replaced or completed meanwhile) is hung up at once. Apply the returned SDP answer to the peer; do not send session.start. Audio uses WebRTC media tracks; the call's end shows as the data channel closing. No provider key or token is returned.",
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
