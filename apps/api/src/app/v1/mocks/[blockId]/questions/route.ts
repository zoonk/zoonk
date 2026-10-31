import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: mockPathParamsSchema,
  toTarget: ({ blockId }) => ({ blockId, kind: "mock" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
