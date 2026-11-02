import {
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { reviewFlagPathParamsSchema, reviewFlagRewriteSchema } from "../schemas/review-flags";
import { AUTHENTICATED_SECURITY } from "../security";

export const reviewFlagPaths = {
  "/library/review-flags/{flagId}/rewrites": {
    post: {
      description:
        "Rewrites what one open review flag names, now instead of in the daily sweep: a lesson built on a source that changed leaves play until its new version, written from the source as it is now, passes the checks; drills on a changed law's article are written again from the new text in place. Admins only.",
      operationId: "createReviewFlagRewrite",
      requestParams: { path: reviewFlagPathParamsSchema },
      responses: {
        "202": {
          content: { "application/json": { schema: reviewFlagRewriteSchema } },
          description: "The rewrite started",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Rewrite flagged content now (admins)",
      tags: ["Library lessons"],
    },
  },
};
