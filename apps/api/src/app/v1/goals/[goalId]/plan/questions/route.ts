import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/**
 * The learner's conversation with their buddy about one of their goals: doubts about what they
 * study, "Why am I studying this today?", and plan changes asked for in their own words.
 */
const routes = tutorQuestionRoutes({
  pathSchema: goalPathParamsSchema,
  toTarget: ({ goalId }) => ({ goalId, kind: "plan" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
