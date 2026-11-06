import { planEffectSchema } from "@zoonk/core/plans/effect-contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { checkpointMoveResponseSchema } from "./checkpoints";

export const challengeStartResponseSchema = z
  .object({
    blockId: uuidSchema(),
    kind: z
      .enum(["checkpoint", "mock"])
      .meta({ description: "Played as a checkpoint (see /checkpoints) or a mock (see /mocks)" }),
    sessionId: uuidSchema(),
  })
  .meta({ id: "ChallengeStart" });

export const challengeGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description: "The run writing the questions: stream GET /generations/{generationId}/events",
      }),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: start the challenge now. `generating`: follow the run's stream until `challengeQuestionsReady`, then start it",
      }),
  })
  .meta({ id: "ChallengeGeneration" });

export const challengeMoveResponseSchema = checkpointMoveResponseSchema
  .extend({
    effect: planEffectSchema
      .nullable()
      .meta({
        description:
          "What making room on the new day did to the plan, such as the lessons it left out; null before the plan is built",
      }),
    planItemId: uuidSchema()
      .nullable()
      .meta({ description: "The challenge on its new day: a dated plan item is a new one" }),
  })
  .meta({ id: "ChallengeMove" });

export const challengeUndoResponseSchema = z
  .object({
    planItemId: uuidSchema()
      .nullable()
      .meta({ description: "The challenge back on its day: a dated plan item is a new one" }),
  })
  .meta({ id: "ChallengeMoveUndo" });
