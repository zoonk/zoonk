import { saveLessonSchema, savedLessonListSchema } from "@zoonk/core/saved-lessons/contract";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const accessErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const savedLessonPaths = {
  "/goals/{goalId}/saved-lessons": {
    get: {
      description:
        "The learner's saves made from this goal or for a lesson in its plan, newest save first. Unavailable lessons retain their saved titles.",
      operationId: "listSavedLessons",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: savedLessonListSchema } },
          description: "The goal's saved lessons",
        },
        ...accessErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List saved lessons",
      tags: ["Learner"],
    },
    post: {
      description:
        "Sets the learner's desired saved state for a lesson. Saving requires a lesson available to start and keeps the first save time on repeats. Removing needs only the learner's own save, from any goal.",
      operationId: "saveLesson",
      requestBody: {
        content: { "application/json": { schema: saveLessonSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: saveLessonSchema } },
          description: "The lesson's saved state",
        },
        ...accessErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save or remove a lesson",
      tags: ["Learner"],
    },
  },
};
