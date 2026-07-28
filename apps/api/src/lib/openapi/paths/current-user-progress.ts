import {
  currentUserActivityResponseSchema,
  currentUserEnergyResponseSchema,
  currentUserLevelResponseSchema,
  currentUserProgressResponseSchema,
  currentUserProgressSnapshotResponseSchema,
  currentUserScorePatternsResponseSchema,
  currentUserScoreResponseSchema,
} from "../schemas/current-user-progress";
import { internalErrorResponse, unauthorizedResponse } from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const requestTimeZoneDescription =
  "Calendar boundaries use the validated timezone resolved from the request and fall back to UTC.";

/**
 * Builds the shared successful and authenticated error responses for one
 * current-user progress resource without weakening each operation's schema.
 */
function getCurrentUserProgressResponses({
  description,
  schema,
}: {
  description: string;
  schema:
    | typeof currentUserActivityResponseSchema
    | typeof currentUserEnergyResponseSchema
    | typeof currentUserLevelResponseSchema
    | typeof currentUserProgressResponseSchema
    | typeof currentUserProgressSnapshotResponseSchema
    | typeof currentUserScorePatternsResponseSchema
    | typeof currentUserScoreResponseSchema;
}) {
  return {
    "200": { content: { "application/json": { schema } }, description },
    "401": unauthorizedResponse,
    "500": internalErrorResponse,
  };
}

export const currentUserProgressPaths = {
  "/me/progress": {
    get: {
      description: `Compact progress totals for Home and overview surfaces. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserProgress",
      responses: getCurrentUserProgressResponses({
        description: "Current learner progress summary",
        schema: currentUserProgressResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner progress",
      tags: ["Progress"],
    },
  },
  "/me/progress/activity": {
    get: {
      description: `Lifetime activity totals and a bounded 53-week completion calendar. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserActivity",
      responses: getCurrentUserProgressResponses({
        description: "Current learner activity",
        schema: currentUserActivityResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner activity",
      tags: ["Progress"],
    },
  },
  "/me/progress/energy": {
    get: {
      description: `Current Energy, a bounded 53-week timeline, and lifetime insights. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserEnergy",
      responses: getCurrentUserProgressResponses({
        description: "Current learner Energy",
        schema: currentUserEnergyResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner Energy",
      tags: ["Progress"],
    },
  },
  "/me/progress/level": {
    get: {
      operationId: "getCurrentUserLevel",
      responses: getCurrentUserProgressResponses({
        description: "Current learner belt and level",
        schema: currentUserLevelResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner level",
      tags: ["Progress"],
    },
  },
  "/me/progress/score": {
    get: {
      description: `Weighted Score and bounded 90-day weekly history. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserScore",
      responses: getCurrentUserProgressResponses({
        description: "Current learner Score",
        schema: currentUserScoreResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner Score",
      tags: ["Progress"],
    },
  },
  "/me/progress/score/patterns": {
    get: {
      description: `Complete weekday and daypart breakdowns for the bounded 90-day Score window. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserScorePatterns",
      responses: getCurrentUserProgressResponses({
        description: "Current learner Score patterns",
        schema: currentUserScorePatternsResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner Score patterns",
      tags: ["Progress"],
    },
  },
  "/me/progress/snapshot": {
    get: {
      description: `Pre-completion milestone facts used by interactive lesson players. ${requestTimeZoneDescription}`,
      operationId: "getCurrentUserProgressSnapshot",
      responses: getCurrentUserProgressResponses({
        description: "Current learner player progress snapshot",
        schema: currentUserProgressSnapshotResponseSchema,
      }),
      security: AUTHENTICATED_SECURITY,
      summary: "Get current learner progress snapshot",
      tags: ["Progress"],
    },
  },
};
