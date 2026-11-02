import { learnerSummaryResponseSchema } from "../schemas/learner-summary";
import { unauthorizedResponse } from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const learnerSummaryPaths = {
  "/me/summary": {
    get: {
      description:
        "What an app's frame shows about the learner or guest in one read: goals, buddy, today's saved queue and missions, places, plan, time zone and analytics settings. It never builds or changes the day. Read it again after `nextChangeAt`.",
      operationId: "getCurrentUserSummary",
      responses: {
        "200": {
          content: { "application/json": { schema: learnerSummaryResponseSchema } },
          description: "The learner summary",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's summary",
      tags: ["Account"],
    },
  },
};
