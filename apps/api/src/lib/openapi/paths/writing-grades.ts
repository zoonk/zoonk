import { writingAttemptSchema } from "@zoonk/core/exams/essays/contract";
import { writingAttemptPathParamsSchema } from "../schemas/essays";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const writingGradePaths = {
  "/essays/attempts/{attemptId}": {
    get: {
      operationId: "getWritingAttempt",
      requestParams: { path: writingAttemptPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: writingAttemptSchema } },
          description: "The learner's submitted text, question criteria and saved feedback",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a graded writing attempt",
      tags: ["Exams"],
    },
  },
};
