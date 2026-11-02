import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: lessonPathParamsSchema,
  toTarget: ({ lessonId }) => ({ kind: "lesson", lessonId }),
});

export const GET = routes.GET;
export const POST = routes.POST;
