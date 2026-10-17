import {
  courseDetailsRegenerationPreviewSchema,
  courseDetailsRegenerationRequestSchema,
  courseDetailsRegenerationResponseSchema,
} from "../schemas/course-details-regenerations";
import {
  forbiddenResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const courseDetailsRegenerationPaths = {
  "/library/courses/details/regenerations": {
    get: {
      description:
        "Counts public outlined courses with stale or unversioned landing copy, or missing copy older than an hour, excluding hand-written copy and pending/running details workflows. Estimates rewriting cost at $0.0006 per course. Reads only; no AI or workflows. Admins only.",
      operationId: "previewCourseDetailsRegeneration",
      responses: {
        "200": {
          content: { "application/json": { schema: courseDetailsRegenerationPreviewSchema } },
          description: "Selected course count, batch limit and estimated total USD cost",
        },
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Preview a course copy rewrite (admins)",
      tags: ["Library courses"],
    },
    post: {
      description:
        "Rewrites landing-page copy for up to 25 public courses with an outline. Includes stale or unversioned copy and missing copy older than an hour, excluding hand-written copy and pending/running details workflows. Descriptions, categories and icons are preserved. Concurrent requests cannot claim the same copy twice. Admins only.",
      operationId: "createCourseDetailsRegeneration",
      requestBody: {
        content: { "application/json": { schema: courseDetailsRegenerationRequestSchema } },
        required: true,
      },
      responses: {
        "202": {
          content: { "application/json": { schema: courseDetailsRegenerationResponseSchema } },
          description: "Started workflows and dispatch failures",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Rewrite stale course page copy (admins)",
      tags: ["Library courses"],
    },
  },
};
