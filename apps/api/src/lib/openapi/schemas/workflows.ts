import { z } from "zod";

const startIndexSchema = z.coerce
  .number()
  .int()
  .min(0)
  .optional()
  .meta({ description: "Zero-based event index to resume from" });

export const generationResourceSchema = z
  .object({
    id: z.string().min(1).meta({ description: "Generation ID" }),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  })
  .meta({ id: "Generation" });

export const generationEventStreamSchema = z
  .string()
  .meta({
    description:
      'Server-Sent Events stream. Every data field contains JSON with a required "status" and "step", plus optional "entityId" and "reason".',
    examples: ['data: {"status":"started","step":"writeLesson"}\n\n'],
  });

export const workflowEventsQuerySchema = z
  .object({ startIndex: startIndexSchema })
  .meta({ id: "WorkflowEventsQuery" });
