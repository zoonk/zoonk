import { itemPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

/**
 * The learner's conversation with their buddy about a question of their study session or mistakes
 * practice: a hint before they check it, why after.
 */
const routes = tutorQuestionRoutes({
  pathSchema: itemPathParamsSchema,
  toTarget: ({ itemId }) => ({ itemId, kind: "item" }),
});

export const GET = routes.GET;
export const POST = routes.POST;
