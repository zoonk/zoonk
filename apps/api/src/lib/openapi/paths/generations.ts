import { z } from "zod";
import { generationPathParamsSchema } from "../schemas/paths";
import {
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  createGenerationRequestSchema,
  generationEventStreamSchema,
  generationResourceSchema,
  workflowEventsQuerySchema,
} from "../schemas/workflows";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

export const generationPaths = {
  "/generations": {
    post: {
      description:
        "Starts authenticated course, curriculum, chapter, or lesson generation. Chapter allowances cover the whole chapter, including later missing lessons and optional activities. Generated public content remains readable after the allowance is used. Private generation is restricted to the owner.",
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
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
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
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a generation",
      tags: ["Workflows"],
    },
  },
  "/generations/{generationId}/events": {
    get: {
      description:
        "Returns a resumable Server-Sent Events stream with generation step updates. Public content generation is readable by guests; private generation requires its owner. Unknown and inaccessible runs return 404.",
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
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Stream generation events (SSE)",
      tags: ["Workflows"],
    },
  },
};
