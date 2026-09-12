import {
  learningProfileResponseSchema,
  learningProfileUpdateSchema,
} from "../schemas/learning-profile";
import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const learningProfilePaths = {
  "/me/learning-profile": {
    get: {
      operationId: "getCurrentUserLearningProfile",
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "The current learner's global interests",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's learning interests",
      tags: ["Account"],
    },
    patch: {
      operationId: "updateCurrentUserLearningProfile",
      requestBody: {
        content: { "application/json": { schema: learningProfileUpdateSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "Updated interests, with other learner preferences preserved",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update current user's learning interests",
      tags: ["Account"],
    },
  },
};
