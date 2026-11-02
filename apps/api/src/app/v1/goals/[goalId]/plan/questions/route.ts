import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: goalPathParamsSchema,
  toTarget: ({ goalId }) => ({ goalId, kind: "plan" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
