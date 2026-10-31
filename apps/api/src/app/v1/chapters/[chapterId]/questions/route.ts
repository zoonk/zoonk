import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: chapterPathParamsSchema,
  toTarget: ({ chapterId }) => ({ chapterId, kind: "chapter" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
