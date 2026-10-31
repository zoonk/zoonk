import { goalSubjectPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: goalSubjectPathParamsSchema,
  toTarget: ({ goalId, subjectKey }) => ({ goalId, kind: "subject", subjectKey }),
});

export const GET = routes.GET;
export const POST = routes.POST;
