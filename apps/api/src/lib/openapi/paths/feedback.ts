import { feedbackResponseSchema, feedbackSubmissionSchema } from "../schemas/feedback";
import {
  forbiddenResponse,
  internalErrorResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";

export const feedbackPaths = {
  "/feedback": {
    post: {
      operationId: "createFeedback",
      requestBody: {
        content: { "application/json": { schema: feedbackSubmissionSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: feedbackResponseSchema } },
          description: "Feedback received",
        },
        "400": validationErrorResponse,
        "403": forbiddenResponse,
        "500": internalErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Submit a feedback message",
      tags: ["Feedback"],
    },
  },
};
