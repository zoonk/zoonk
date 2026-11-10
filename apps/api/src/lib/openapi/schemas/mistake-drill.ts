import { MISTAKE_DRILL_KINDS } from "@zoonk/core/mistakes/drills";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const mistakeDrillSchema = z
  .object({
    kind: z
      .enum(MISTAKE_DRILL_KINDS)
      .meta({
        description:
          "The practice the mistake's cause calls for: reteach (content gap: the lesson's idea first), readCarefully (misread: a note to read every word before answering), spotTheTrap (trap: only the trap matching a wrong answer is named), timed (ran out of time: a time box per question), noGuessing (guess: an honest \"I'm not sure\" instead of a guess), retry (cause not known yet)",
      }),
    lesson: z
      .object({
        id: uuidSchema(),
        ideas: z
          .array(z.string())
          .meta({ description: "The lesson's summary card, one idea each" }),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The lesson to go over before the questions, for a content gap" }),
    timeLimitSeconds: z
      .number()
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          "Seconds per question in a timed drill. An answer that takes them all counts as wrong; send dontKnow when time runs out",
      }),
  })
  .meta({ id: "MistakeDrill" });
