import { z } from "zod";

const startIndexSchema = z.coerce
  .number()
  .int()
  .min(0)
  .optional()
  .meta({ description: "Zero-based event index to resume from" });

const generationTargetSchema = z
  .object({
    id: z.uuid().meta({ description: "Course prompt, chapter, or lesson ID to generate" }),
    type: z
      .enum(["coursePrompt", "chapter", "lesson"])
      .meta({ description: "Resource type to generate" }),
  })
  .meta({ id: "GenerationTarget" });

export const createGenerationRequestSchema = z
  .object({ target: generationTargetSchema })
  .meta({ id: "CreateGenerationRequest" });

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
    examples: ['data: {"status":"started","step":"getLesson"}\n\n'],
  });

export const workflowEventsQuerySchema = z
  .object({ startIndex: startIndexSchema })
  .meta({ id: "WorkflowEventsQuery" });
