import { z } from "zod";

const speechProvenanceSchema = z.object({
  generatedAt: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  runId: z.string(),
});

/** `ContentFix.voice`: the clip a word or sentence fix voiced for its text, or why it couldn't. */
export const contentFixVoiceSchema = z
  .discriminatedUnion("status", [
    z.object({
      provenance: speechProvenanceSchema,
      status: z.literal("voiced"),
      text: z.string(),
      url: z.url(),
    }),
    z.object({ status: z.literal("failed") }),
  ])
  .meta({ id: "ContentFixVoice" });

export type ContentFixVoice = z.infer<typeof contentFixVoiceSchema>;
