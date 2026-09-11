import {
  courseEditionRequestSchema,
  courseEditionResponseSchema,
} from "../schemas/course-editions";
import { coursePathParamsSchema } from "../schemas/paths";
import {
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { OPTIONAL_AUTHENTICATION_SECURITY, PUBLIC_SECURITY } from "../security";

const editionResponses = {
  "200": {
    content: { "application/json": { schema: courseEditionResponseSchema } },
    description: "Available edition, existing generation, missing edition, or unsupported request",
  },
  "400": validationErrorResponse,
  "404": notFoundResponse,
};

export const courseEditionPaths = {
  "/courses/{courseId}/editions": {
    get: {
      description:
        "Finds a course edition in the requested instructional language. Proven existing editions may be linked on demand; reading never runs identity models or creates generation requests.",
      operationId: "getCourseEdition",
      requestParams: { path: coursePathParamsSchema, query: courseEditionRequestSchema },
      responses: editionResponses,
      security: PUBLIC_SECURITY,
      summary: "Find a course language edition",
      tags: ["Courses"],
    },
    post: {
      description:
        "Reuses an existing edition publicly. If none exists, authentication is required to resolve the source title through normal course identity search and prepare generation. A generation result identifies the course prompt to submit to POST /generations.",
      operationId: "resolveCourseEdition",
      requestBody: {
        content: { "application/json": { schema: courseEditionRequestSchema } },
        required: true,
      },
      requestParams: { path: coursePathParamsSchema },
      responses: { ...editionResponses, "401": unauthorizedResponse, "403": forbiddenResponse },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Resolve a course language edition",
      tags: ["Courses"],
    },
  },
};
