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
    status: z
      .enum(["pending", "running", "completed", "failed", "cancelled"])
      .meta({
        description:
          "A run that stopped without ending (no progress for 30 minutes, as after a crash) reads `failed`: start the work again, and the new run takes its place.",
      }),
  })
  .meta({ id: "Generation" });

export const generationEventStreamSchema = z
  .string()
  .meta({
    description:
      'Server-Sent Events stream. Every data field contains JSON with a required "status" and "step", plus optional "entityId", "reason", "at" (when the step reported it, in milliseconds since the epoch), "skillName" (a skill `buildSkillGraph` just wrote, in a `started` event of its own as each one is written; a graph written again names its skills again) and "warmUpId". Once the goal\'s deck is ready, a `completed` event with step `warmUpReady` carries its `warmUpId`: read GET /warm-ups/{warmUpId} for the deck. Each goal-building run reports the deck once, including a reused deck or one already ready on retry. This event is never sent when the goal has no deck.',
    examples: [
      'data: {"at":1760000000000,"status":"started","step":"writeLesson"}\n\n',
      'data: {"at":1760000000000,"skillName":"Variables","status":"started","step":"buildSkillGraph"}\n\n',
      'data: {"at":1760000000000,"status":"completed","step":"warmUpReady","warmUpId":"019a482c-6a00-7000-8000-000000000001"}\n\n',
    ],
  });

export const workflowEventsQuerySchema = z
  .object({ startIndex: startIndexSchema })
  .meta({ id: "WorkflowEventsQuery" });
