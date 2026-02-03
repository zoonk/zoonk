import { z } from "zod";
import { errorSchema } from "./common";
import { workflowStatusQuerySchema, workflowTriggerResponseSchema } from "./workflows";

export const validationErrorResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Validation error",
} as const;

const subscriptionRequiredResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Subscription required",
} as const;

const workflowStartedResponse = {
  content: { "application/json": { schema: workflowTriggerResponseSchema } },
  description: "Workflow started",
} as const;

const sseStreamResponse = {
  content: { "text/event-stream": { schema: z.string() } },
  description: "SSE stream of workflow status",
} as const;

export function workflowTriggerEndpoint({
  schema,
  summary,
  requiresSubscription = false,
}: {
  schema: z.ZodType;
  summary: string;
  requiresSubscription?: boolean;
}) {
  return {
    post: {
      ...(requiresSubscription && { description: "Requires active subscription." }),
      requestBody: {
        content: { "application/json": { schema } },
      },
      responses: {
        "200": workflowStartedResponse,
        "400": validationErrorResponse,
        ...(requiresSubscription && { "402": subscriptionRequiredResponse }),
      },
      summary,
      tags: ["Workflows"],
    },
  };
}

export function workflowStatusEndpoint(summary: string) {
  return {
    get: {
      description: "Returns a Server-Sent Events stream with workflow status updates.",
      requestParams: { query: workflowStatusQuerySchema },
      responses: {
        "200": sseStreamResponse,
      },
      summary,
      tags: ["Workflows"],
    },
  };
}
