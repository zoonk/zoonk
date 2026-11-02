import { feedbackResponseSchema, feedbackSubmissionSchema } from "../schemas/feedback";
import {
  forbiddenResponse,
  internalErrorResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

export const feedbackPaths = {
  "/feedback": {
    post: {
      description:
        "Stores the message with its context, plus the model and prompt version behind the content it's about when known, and emails it to the team. Anyone can send one; a signed-in learner's message is linked to their account.",
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
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Submit a feedback message",
      tags: ["Feedback"],
    },
  },
};
