import {
  completedLessonListQuerySchema,
  completedLessonListResponseSchema,
} from "../schemas/completed-lessons";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const completedLessonPaths = {
  "/me/completed-lessons": {
    get: {
      description:
        "The goal's completed lessons, one per lesson, newest first by the last time the learner finished it, so a replay moves a lesson to the top. A lesson counts for the goal when the learner finished it and it's in the goal's plan (finishing a lesson checks it off in every plan) or the learner studied it while the goal was active. Review capsules, skipped and tested-out lessons, practice and unfinished runs are left out. Group the rows by `finishedOn`. A replay can shift later pages by one: skip a lesson already shown.",
      operationId: "listCurrentUserCompletedLessons",
      requestParams: { query: completedLessonListQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: completedLessonListResponseSchema } },
          description: "A page of completed lessons",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's completed lessons",
      tags: ["Library lessons"],
    },
  },
};
