import { goalSubjectPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/**
 * The learner's conversation with their buddy about one subject of their goal: what it covers,
 * how far they are in it and whether the plan covers all of it, with the goal's plan at hand.
 */
const routes = tutorQuestionRoutes({
  pathSchema: goalSubjectPathParamsSchema,
  toTarget: ({ goalId, subjectKey }) => ({ goalId, kind: "subject", subjectKey }),
});

export const GET = routes.GET;
export const POST = routes.POST;
