import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/** The learner's questions about the plan of one of their goals: "Why am I studying this today?" */
const routes = tutorQuestionRoutes({
  pathSchema: goalPathParamsSchema,
  toTarget: ({ goalId }) => ({ goalId, kind: "plan" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
