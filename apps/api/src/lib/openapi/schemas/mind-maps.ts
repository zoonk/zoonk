import { z } from "zod";

export const mindMapGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run making the map, once it has one: GET /generations/{generationId} for its status",
      }),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: GET the map now. `generating`: GET the map every few seconds until it's no longer `generating` (about a minute)",
      }),
  })
  .meta({ id: "MindMapGeneration" });
