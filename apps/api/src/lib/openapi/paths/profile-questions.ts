import { profileAnswerInputSchema } from "@zoonk/core/profile/questions/contract";
import {
  profileAnswerResponseSchema,
  profileQuestionsResponseSchema,
} from "../schemas/profile-questions";
import {
  conflictResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const profileQuestionPaths = {
  "/me/profile-questions": {
    get: {
      description:
        "Returns all questions with localized options and the learner's saved answers. Does not write or start AI work.",
      operationId: "getCurrentUserProfileQuestions",
      responses: {
        "200": {
          content: { "application/json": { schema: profileQuestionsResponseSchema } },
          description: "Localized questions and saved answers",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the learner's optional profile questions",
      tags: ["Profile"],
    },
  },
  "/me/profile-questions/answers": {
    post: {
      description:
        "Saves or declines one question. Biography answers require memory on; conditions require explicit consent. Typed memory facts start sensitive until a follow-up checks them.",
      operationId: "answerCurrentUserProfileQuestion",
      requestBody: {
        content: { "application/json": { schema: profileAnswerInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: profileAnswerResponseSchema } },
          description: "The saved question",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "409": {
          ...conflictResponse,
          description: "MEMORY_OFF: biography questions cannot be saved with memory off",
        },
        "422": {
          ...validationErrorResponse,
          description: "Invalid answer, or CONSENT_REQUIRED for conditions without consent",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Replace one optional profile answer",
      tags: ["Profile"],
    },
  },
};
