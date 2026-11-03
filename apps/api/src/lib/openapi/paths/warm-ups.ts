import { warmUpDeckSchema } from "@zoonk/core/library/warm-ups/contract";
import { warmUpPathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const warmUpPaths = {
  "/warm-ups/{warmUpId}": {
    get: {
      description:
        "A shared deck of quick guessing cards for a signed-in learner or guest. Includes the answers and reveals so every card works without another request. Only ready decks are served; a missing deck or one still being written or failed returns 404.",
      operationId: "getWarmUp",
      requestParams: { path: warmUpPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: warmUpDeckSchema } },
          description: "The ready warm-up deck",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": { ...notFoundResponse, description: "The deck is missing or not ready" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a warm-up deck",
      tags: ["Warm-ups"],
    },
  },
};
