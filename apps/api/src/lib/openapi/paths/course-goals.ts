import { courseGoalStartInputSchema } from "@zoonk/core/goals/course-start-contract";
import { goalSchema } from "../schemas/goals";
import { coursePathParamsSchema } from "../schemas/paths";
import { targetDateOutOfRangeResponse } from "../schemas/plan-errors";
import {
  guestRefusalResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const courseGoalPaths = {
  "/courses/{courseId}/goals": {
    post: {
      description:
        "Starts a Library course as the learner's goal, with nothing to type or confirm: a learn goal on the course (a language goal for a language course, or an exam goal for a course linked to a public exam blueprint) whose plan is built from the course's outline right away, its level bands as phases, starting at `chapterId` when one is sent (the chapters before it are left out). Onboarding (GET /goals/{goalId}/onboarding) then asks the level, an optional date, and the learner's time, and places them (a language's level test); a chapter start skips the level and placement. The optional `targetDate` sets a deadline; explicit null skips the date, while an omitted date defaults to the linked exam's next stored date when available. A new goal's run starts writing ahead what its plan needs (placement's questions, the first lessons); follow it through the onboarding's `generationId`, or POST /goals/{goalId}/generations when it didn't start. A course nobody outlined yet gets its plan from that run. It counts against the plan's goal limits (429 GOAL_LIMIT_REACHED or SLOW_DOWN, or 403 SIGN_UP_REQUIRED for a guest once the day's AI budget all guests share is spent); the learner's active goal already on the course comes back instead (200). Published public courses, and the learner's own private ones. Guests can start one.",
      operationId: "startCourseGoal",
      requestBody: {
        content: { "application/json": { schema: courseGoalStartInputSchema } },
        required: true,
      },
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalSchema } },
          description: "The learner's goal already on this course",
        },
        "201": {
          content: { "application/json": { schema: goalSchema } },
          description: "The new goal",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": guestRefusalResponse,
        "404": notFoundResponse,
        "422": targetDateOutOfRangeResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a course as a goal",
      tags: ["Goals"],
    },
  },
};
