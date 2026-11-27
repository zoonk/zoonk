import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

// Kept for clients released before Buddy conversations. Remove in the next release.
const routes = tutorQuestionRoutes({
  pathSchema: goalPathParamsSchema,
  toTarget: ({ goalId }) => ({ conversationId: null, goalId, kind: "plan" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
