import { goalBuddyConversationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { tutorQuestionRoutes } from "@/lib/tutor-question-routes";

const routes = tutorQuestionRoutes({
  pathSchema: goalBuddyConversationPathParamsSchema,
  toTarget: ({ conversationId, goalId }) => ({ conversationId, goalId, kind: "plan" }),
});

export const { GET, POST } = routes;
