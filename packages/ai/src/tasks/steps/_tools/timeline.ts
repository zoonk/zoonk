import { z } from "zod";

export const timelineInputSchema = z.object({
  events: z
    .array(
      z.object({
        date: z.string().describe("Flexible format: '1956', 'Early 2000s', 'March 2024'"),
        description: z.string().describe("Event description (max 150 chars)"),
        title: z.string().describe("Brief title (max 50 chars)"),
      }),
    )
    .describe("Chronological events"),
  stepIndex: z.number().describe("The step index (0-based) this visual is for"),
});
