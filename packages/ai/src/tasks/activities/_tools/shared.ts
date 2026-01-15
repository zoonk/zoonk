import { z } from "zod";

const contextKindSchema = z.enum([
  "text",
  "code",
  "image",
  "table",
  "chart",
  "diagram",
  "timeline",
  "quote",
]);

export const contextSchema = z.object({
  description: z
    .string()
    .describe(
      "For text: the actual scenario (max 300 chars). For visual kinds: describe what to generate.",
    ),
  kind: contextKindSchema.describe(
    "Use 'text' for most questions. Other kinds only when visual analysis is essential.",
  ),
});
