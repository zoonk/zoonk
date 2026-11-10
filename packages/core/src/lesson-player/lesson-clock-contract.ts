import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const lessonClockInputSchema = z
  .object({
    clockId: uuidSchema().describe("The clockId returned by this player's latest lesson start"),
    runId: uuidSchema(),
    sequence: z
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .describe(
        "Increase for every visibility transition in this clock, beginning at 1; retry with the same number",
      ),
    state: z.enum(["paused", "running"]),
  })
  .strict()
  .meta({ id: "LessonClockInput" });

export type LessonClockInput = z.infer<typeof lessonClockInputSchema>;

export const lessonClockResultSchema = z
  .object({ status: z.enum(["updated", "ignored"]) })
  .meta({ id: "LessonClockResult" });
