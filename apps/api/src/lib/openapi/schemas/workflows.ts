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
      'Server-Sent Events stream. Every data field contains JSON with a required "status" and "step", plus optional "entityId", "reason", "at" (when the step reported it, in milliseconds since the epoch), "skillName" (a skill `buildSkillGraph` just wrote, in a `started` event of its own as each one is written; a graph written again names its skills again), "lessonId", "lessonTitle" and "warmUpId". Once the goal\'s deck is ready, a `completed` event with step `warmUpReady` carries its `warmUpId`: read GET /warm-ups/{warmUpId} for the deck. When the run ends its deck step without one (the goal gets no deck, the deck failed, or another run\'s deck wasn\'t ready in time), a `completed` event with step `warmUpFailed` says so: a wait showing the quiz\'s skeleton turns to its progress. A run that builds the plan (a first build or a retry before the plan exists) ends its deck step with exactly one of the two, including a reused or already linked deck. A run on an existing plan sends neither. A learn goal whose first lesson is picked before its plan reports it on the same stream: a `started` event with step `writeFirstLesson` carries its `lessonId` and `lessonTitle`, and a `completed` event with step `firstLessonReady` carries its `lessonId` once the learner can start it, before or after `goalReady`. Each is sent at most once per run; after a reconnect, read the onboarding\'s `firstLesson`.',
    examples: [
      'data: {"at":1760000000000,"status":"started","step":"writeLesson"}\n\n',
      'data: {"at":1760000000000,"skillName":"Variables","status":"started","step":"buildSkillGraph"}\n\n',
      'data: {"at":1760000000000,"status":"completed","step":"warmUpReady","warmUpId":"019a482c-6a00-7000-8000-000000000001"}\n\n',
      'data: {"at":1760000000000,"lessonId":"019a482c-6a00-7000-8000-000000000002","lessonTitle":"Why birds sing at dawn","status":"started","step":"writeFirstLesson"}\n\n',
      'data: {"at":1760000000000,"lessonId":"019a482c-6a00-7000-8000-000000000002","status":"completed","step":"firstLessonReady"}\n\n',
    ],
  });

export const workflowEventsQuerySchema = z
  .object({ startIndex: startIndexSchema })
  .meta({ id: "WorkflowEventsQuery" });
