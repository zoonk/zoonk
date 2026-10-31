import {
  lessonRegenerationRequestSchema,
  lessonRegenerationResponseSchema,
} from "../schemas/lesson-regenerations";
import {
  forbiddenResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const lessonRegenerationPaths = {
  "/library/lessons/regenerations": {
    post: {
      description:
        "Rewrites the oldest published Library lessons whose screens a model or prompt version wrote, up to 25 per request. Each lesson leaves play until its new version passes the checks, and learners keep their answers. Admins only.",
      operationId: "createLessonRegeneration",
      requestBody: {
        content: { "application/json": { schema: lessonRegenerationRequestSchema } },
        required: true,
      },
      responses: {
        "202": {
          content: { "application/json": { schema: lessonRegenerationResponseSchema } },
          description: "The lessons being rewritten",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Rewrite lessons by model or prompt version (admins)",
      tags: ["Library lessons"],
    },
  },
};
