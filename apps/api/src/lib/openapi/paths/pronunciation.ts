import {
  pronunciationAnswerGradeSchema,
  pronunciationReviewsViewSchema,
  pronunciationRoundInputSchema,
  pronunciationRoundResultSchema,
} from "@zoonk/core/language/pronunciation/contract";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  pronunciationAnswerRequestSchema,
  pronunciationReviewPathParamsSchema,
  pronunciationRoundPathParamsSchema,
} from "../schemas/pronunciation";
import {
  jsonResponse,
  notFoundResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const errorResponses = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
  "422": unprocessableEntityResponse,
};

const common = { security: AUTHENTICATED_SECURITY, tags: ["Language"] };

export const pronunciationPaths = {
  "/goals/{goalId}/pronunciation-reviews": {
    get: {
      ...common,
      description:
        "Words a language goal's learner mispronounced in spoken answers that are due to be said again today, a round's worth at a time: the native recording, the respelling and sound tip for the learner's language, and the romanization. `NOT_LANGUAGE` for other goals.",
      operationId: "listPronunciationReviews",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(pronunciationReviewsViewSchema, "The words to say again"),
        ...errorResponses,
      },
      summary: "List pronunciation reviews",
    },
  },
  "/pronunciation-reviews/{reviewId}/answers": {
    post: {
      ...common,
      description:
        "The learner said a review word again. An audio model judges whether a listener would recognize it, not the accent (falling back to transcription), the answer counts as time spoken in the language, and the word comes back after 1, 3 then 7 days while it's said right, or tomorrow again when it isn't. `NO_SPEECH` when no word was heard. The audio is never kept.",
      operationId: "answerPronunciationReview",
      requestBody: {
        content: { "multipart/form-data": { schema: pronunciationAnswerRequestSchema } },
        required: true,
      },
      requestParams: { path: pronunciationReviewPathParamsSchema },
      responses: {
        "200": jsonResponse(
          pronunciationAnswerGradeSchema,
          "What we heard and when the word comes back",
        ),
        ...smallAiHelpRefusalResponses,
        ...errorResponses,
      },
      summary: "Say a review word",
    },
  },
  "/pronunciation-rounds/{roundId}/completions": {
    post: {
      ...common,
      description:
        "Counts a finished round of pronunciation reviews like any practice: Brain Power, today's time and answers, Energy and the activity ledger. Repeating it returns the same result.",
      operationId: "completePronunciationRound",
      requestBody: {
        content: { "application/json": { schema: pronunciationRoundInputSchema } },
        required: true,
      },
      requestParams: { path: pronunciationRoundPathParamsSchema },
      responses: {
        "200": jsonResponse(pronunciationRoundResultSchema, "What the round earned"),
        ...errorResponses,
      },
      summary: "Finish a pronunciation round",
    },
  },
};
