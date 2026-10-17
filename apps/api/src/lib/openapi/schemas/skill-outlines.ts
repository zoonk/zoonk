import { z } from "zod";

export const skillOutlineGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run writing it, when this request started one: GET /generations/{generationId} for its status",
      }),
    status: z
      .enum(["ready", "writing"])
      .meta({
        description:
          "`ready`: GET the topic's outline now. `writing`: GET it every few seconds until it's `ready` (about half a minute for the topic's first chapter)",
      }),
  })
  .meta({ id: "SkillOutlineGeneration" });
