import {
  currentUserCourseListResponseSchema,
  currentUserCoursesQuerySchema,
} from "../schemas/current-learning";
import { badRequestResponse, unauthorizedResponse } from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const currentLearningPaths = {
  "/me/courses": {
    get: {
      description:
        "The courses the learner's goals are built on and the courses they started lessons in, most recent activity first. Lists published brand courses and the learner's own private courses (without an organization).",
      operationId: "listCurrentUserCourses",
      requestParams: { query: currentUserCoursesQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: currentUserCourseListResponseSchema } },
          description: "Paginated learner courses",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List current user's courses",
      tags: ["Courses"],
    },
  },
};
