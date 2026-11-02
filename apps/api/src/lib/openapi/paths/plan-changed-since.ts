import { planChangedSinceSchema } from "@zoonk/core/plans/changed-since-contract";
import { goalPathParamsSchema } from "../schemas/paths";
import { planChangedSinceQuerySchema } from "../schemas/plan-changed-since";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const planChangedSincePaths = {
  "/goals/{goalId}/plan/changed-since": {
    get: {
      description:
        "Whether the plan (`watch=plan`) or Today (`watch=today`) changed since the client read it, for a screen waiting on lessons being written: ask every few seconds and read the plan (`GET /goals/{goalId}/plan`) or Today (`GET /today`) again only when it answers `changed`. Asking costs a few small reads, where reading the plan or Today again costs a few hundred.",
      operationId: "getPlanChangedSince",
      requestParams: { path: goalPathParamsSchema, query: planChangedSinceQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: planChangedSinceSchema } },
          description: "Whether it changed",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Check whether a plan changed since a read",
      tags: ["Plans"],
    },
  },
};
