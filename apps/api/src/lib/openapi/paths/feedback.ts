import { contentVoteTargetSchema } from "@zoonk/core/feedback/contract";
import {
  contentVoteRequestSchema,
  contentVoteSchema,
  feedbackResponseSchema,
  feedbackSubmissionSchema,
} from "../schemas/feedback";
import {
  forbiddenResponse,
  internalErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

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
  "/me/content-votes/{contentKind}/{contentId}": {
    get: {
      description:
        "The signed-in learner's own vote on one piece of content, so a menu or thumbs can show what they picked. 404 when they haven't voted on it.",
      operationId: "getContentVote",
      requestParams: { path: contentVoteTargetSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentVoteSchema } },
          description: "The stored vote",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the learner's vote on AI content",
      tags: ["Feedback"],
    },
    put: {
      description:
        "Stores the signed-in learner's vote on a course, chapter, lesson, screen, variant, item, image, answer explanation, tutor answer, plan or plan change. There is one vote per learner and content: voting again replaces it. The vote keeps a snapshot of the model and prompt version behind the content.",
      operationId: "voteOnContent",
      requestBody: {
        content: { "application/json": { schema: contentVoteRequestSchema } },
        required: true,
      },
      requestParams: { path: contentVoteTargetSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentVoteSchema } },
          description: "The stored vote",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Vote on AI content",
      tags: ["Feedback"],
    },
  },
};
