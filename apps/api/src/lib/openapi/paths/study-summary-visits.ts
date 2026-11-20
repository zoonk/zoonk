import {
  studySessionSummaryVisitInputSchema,
  studySessionSummaryVisitSchema,
} from "@zoonk/core/sessions/summary-visit-contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import { studySessionPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  jsonResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const studySummaryVisitPaths = {
  "/study-sessions/{sessionId}/summary/visit": {
    post: {
      description:
        "Records the first summary visit across the learner's sessions on the session's local day, once a session has stopped or its work is finished. Retrying the first visit with its original ID returns the same result.",
      operationId: "createStudySessionSummaryVisit",
      requestBody: {
        content: { "application/json": { schema: studySessionSummaryVisitInputSchema } },
        required: true,
      },
      requestParams: { path: studySessionPathParamsSchema },
      responses: {
        "200": jsonResponse(studySessionSummaryVisitSchema, "The daily summary visit result"),
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: `The session has not been stopped and has no finished queue (${studySessionErrorCodes.summaryNotReady})`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Record a study session summary visit",
      tags: ["Study sessions"],
    },
  },
};
