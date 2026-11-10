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
      .enum(["ready", "writingLessons", "drawing"])
      .meta({
        description:
          "`ready`: GET the map now. `writingLessons`: its lessons are being written first, then the map (a few minutes); GET the status every 15 seconds. `drawing`: being written and drawn (about half a minute); GET the status every 4 seconds. Stop once it's neither",
      }),
  })
  .meta({ id: "MindMapGeneration" });
