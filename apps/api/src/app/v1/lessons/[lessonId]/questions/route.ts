import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/** The learner's questions about a Library lesson: all of it, one screen or an answer. */
const routes = tutorQuestionRoutes({
  pathSchema: lessonPathParamsSchema,
  toTarget: ({ lessonId }) => ({ kind: "lesson", lessonId }),
});

export const GET = routes.GET;
export const POST = routes.POST;
