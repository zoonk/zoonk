import {
  languageConversationCompletionInputSchema,
  languageConversationObjectiveCheckInputSchema,
  languageConversationObjectiveCheckSchema,
  languageConversationSetupSchema,
  languageConversationStartInputSchema,
  languageConversationViewSchema,
} from "@zoonk/core/language/conversations/contract";
import {
  languageConversationCreatedSchema,
  languageConversationPathParamsSchema,
} from "../schemas/language";
import {
  conflictResponse,
  jsonResponse,
  notFoundResponse,
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

/** Live conversations: start one, read it, connect to GPT-Live, mark its goals, finish it. */
export const languageConversationPaths = {
  "/language-conversations": {
    post: {
      ...common,
      description:
        "Starts a live conversation: practice for a unit (1 to 5 minutes), a language goal's checkpoint call (its length set by the learner's level), or a speaking mock of the exam the goal prepares for (IELTS or TOEFL iBT). The character speaks at the learner's speaking level. Nothing is charged until the call connects.",
      operationId: "startLanguageConversation",
      requestBody: {
        content: { "application/json": { schema: languageConversationStartInputSchema } },
        required: true,
      },
      responses: {
        "201": jsonResponse(languageConversationCreatedSchema, "The new conversation"),
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
        "Ends the call with its transcript, help used, time spoken and the voice session's length. The goals met are the ones marked during the call plus any the full transcript shows; a separate model writes the feedback; a won checkpoint call closes the unit. Repeating it returns the same result.",
      operationId: "completeLanguageConversation",
      requestBody: {
        content: { "application/json": { schema: languageConversationCompletionInputSchema } },
        required: true,
      },
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "200": jsonResponse(languageConversationViewSchema, "The finished conversation"),
        ...readErrors,
      },
      summary: "Finish a live conversation",
    },
  },
  "/language-conversations/{conversationId}/connections": {
    post: {
      ...common,
      description:
        "Opens the call: each connection holds the call's length from the call time on the learner's plan, today's and this month's (guests have none; with less left, the call runs what's left, and with under a minute left this returns 429 until the next day or month, `details.period` says which), and returns a short-lived, single-use token for GPT-Live with the Live WebSocket to open with it and how long the call may run (`seconds`). Send `session.start` first with the model, the conversation's `instructions`, PCM16 audio at 24 kHz and client delegation; then stream the microphone and play the audio GPT-Live returns. After each learner turn, send the transcript to objective-checks. Wrap up shortly before `seconds` and close the session then; when `endsAtLimit` is set, tell the learner their call time for the day or the month is almost up (never how much call time the plan has). Completing the call keeps only the time it ran; connecting again after a drop starts the call over.",
      operationId: "connectLanguageConversation",
      requestParams: { path: languageConversationPathParamsSchema },
      responses: {
        "201": jsonResponse(languageConversationSetupSchema, "How to connect"),
        "409": conflictResponse,
        "429": tooManyRequestsResponse,
        ...readErrors,
      },
      summary: "Connect a live conversation",
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
        "429": tooManyRequestsResponse,
        ...readErrors,
      },
      summary: "Check a live conversation's goals",
    },
  },
};
