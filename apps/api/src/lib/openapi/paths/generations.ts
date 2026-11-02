import { generationPathParamsSchema } from "../schemas/paths";
import { notFoundResponse, validationErrorResponse } from "../schemas/responses";
import {
  generationEventStreamSchema,
  generationResourceSchema,
  workflowEventsQuerySchema,
} from "../schemas/workflows";
import { PUBLIC_SECURITY } from "../security";

export const generationPaths = {
  "/generations/{generationId}": {
    get: {
      operationId: "getGeneration",
      requestParams: { path: generationPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: generationResourceSchema } },
          description: "Current generation status",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a generation",
      tags: ["Workflows"],
    },
  },
  "/generations/{generationId}/events": {
    get: {
      description:
        "Returns a resumable Server-Sent Events stream with generation step updates. A run that stopped without ending gets a stream that ends at once: read its status, which says `failed`.",
      operationId: "streamGenerationEvents",
      requestParams: { path: generationPathParamsSchema, query: workflowEventsQuerySchema },
      responses: {
        "200": {
          content: { "text/event-stream": { schema: generationEventStreamSchema } },
          description: "Generation event stream",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Stream generation events (SSE)",
      tags: ["Workflows"],
    },
  },
};
