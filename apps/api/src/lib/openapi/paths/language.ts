import { spokenAnswerGradeSchema } from "@zoonk/core/library/language/spoken-answer-contract";
import { spokenAnswerRequestSchema } from "../schemas/language";
import {
  notFoundResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { stepPathParamsSchema } from "../schemas/steps";
import { AUTHENTICATED_SECURITY } from "../security";

export const languagePaths = {
  "/steps/{stepId}/spoken-answers": {
    post: {
      description:
        "Grades a \"say it out loud\" screen: transcribes the recording as said, compares it with the expected sentence word by word, explains at most two words that didn't match in the learner's language (shared with everyone who says the same thing) and records the answer. An accent never blocks progress. 422 `NO_SPEECH` when no words were heard. The audio is only used for grading and never kept.",
      operationId: "createSpokenAnswer",
      requestBody: {
        content: { "multipart/form-data": { schema: spokenAnswerRequestSchema } },
        required: true,
      },
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: spokenAnswerGradeSchema } },
          description: "What we heard and how each word came out",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
        ...smallAiHelpRefusalResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a speaking screen",
      tags: ["Language"],
    },
  },
};
