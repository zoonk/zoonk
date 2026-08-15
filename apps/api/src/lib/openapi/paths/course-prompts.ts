import {
  coursePromptGenerationResponseSchema,
  coursePromptPathParamsSchema,
  resolveCoursePromptRequestSchema,
  resolveCoursePromptResponseSchema,
} from "../schemas/course-prompts";
import {
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { OPTIONAL_AUTHENTICATION_SECURITY, PUBLIC_SECURITY } from "../security";

export const coursePromptPaths = {
  "/course-prompts": {
    post: {
      description:
        "Returns existing courses and side-effect-free cached classifications publicly. Authentication is required before a prompt can use AI or create a generation request.",
      operationId: "createCoursePrompt",
      requestBody: {
        content: { "application/json": { schema: resolveCoursePromptRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: resolveCoursePromptResponseSchema } },
          description: "Course, generation, or classification outcome",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Resolve a course request",
      tags: ["Course prompts"],
    },
  },
  "/course-prompts/{coursePromptId}": {
    get: {
      operationId: "getCoursePrompt",
      requestParams: { path: coursePromptPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: coursePromptGenerationResponseSchema } },
          description: "Course prompt generation state",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a course prompt",
      tags: ["Course prompts"],
    },
  },
};
