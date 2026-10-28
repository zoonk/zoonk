import { itemPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: itemPathParamsSchema,
  toTarget: ({ itemId }) => ({ itemId, kind: "item" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
