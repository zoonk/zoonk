import { staffLessonParamsSchema, staffLessonSchema } from "@zoonk/core/staff/lesson-contract";
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
} from "../schemas/responses";

export const staffPaths = {
  "/staff/lessons/{lessonId}": {
    get: {
      description:
        "Reads the lesson plan, map ideas, current screen version and vocabulary. Requires a staff CLI token with staff:read.",
      operationId: "getStaffLesson",
      requestParams: { path: staffLessonParamsSchema },
      responses: {
        "200": jsonResponse(staffLessonSchema, "The lesson's editable content"),
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: [{ staffCliAuth: [] }],
      summary: "Read a lesson for a content fix",
      tags: ["Content fixes"],
    },
    servers: [{ url: "/" }],
  },
};
