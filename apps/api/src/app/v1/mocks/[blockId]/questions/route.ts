import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/** The learner's questions about one of their mocks, once it's finished. */
const routes = tutorQuestionRoutes({
  pathSchema: mockPathParamsSchema,
  toTarget: ({ blockId }) => ({ blockId, kind: "mock" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
