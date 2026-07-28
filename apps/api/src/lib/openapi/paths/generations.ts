import { z } from "zod";
import { generationPathParamsSchema } from "../schemas/paths";
import {
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  createGenerationRequestSchema,
  generationEventStreamSchema,
  generationResourceSchema,
  workflowEventsQuerySchema,
} from "../schemas/workflows";
import { OPTIONAL_AUTHENTICATION_SECURITY, PUBLIC_SECURITY } from "../security";

export const generationPaths = {
  "/generations": {
    post: {
      description:
        "Starts course, chapter, or lesson generation. Chapter and lesson targets require an active subscription when the free first-chapter rule does not apply.",
      operationId: "createGeneration",
      requestBody: {
        content: { "application/json": { schema: createGenerationRequestSchema } },
        required: true,
      },
      responses: {
        "202": {
          content: { "application/json": { schema: generationResourceSchema } },
          description: "Generation accepted",
          headers: z.object({
            Location: z.string().meta({ description: "Canonical URL for the accepted generation" }),
          }),
        },
        "400": badRequestResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Create a generation",
      tags: ["Workflows"],
    },
  },
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
      description: "Returns a resumable Server-Sent Events stream with generation step updates.",
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
