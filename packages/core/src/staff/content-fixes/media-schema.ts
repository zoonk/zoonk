import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { iconNeedSchema } from "../../library/marks/step-marks";

const key = z.string().min(1);

const clipIdentity = z.object({
  language: z.string(),
  model: z.enum(["AlphabetCard", "Sentence", "Word"]),
  text: z.string(),
});

export function clipMediaKey({ language, model, text }: z.infer<typeof clipIdentity>): string {
  return `${model}:${language}:${text}`;
}

const needSchema = z.discriminatedUnion("kind", [
  clipIdentity.extend({ key, kind: z.literal("clip"), orgSlug: z.string().optional() }),
  z.object({
    alt: z.string().optional(),
    category: z.string().optional(),
    context: z.string().optional(),
    key,
    kind: z.literal("picture"),
    language: z.string(),
    numberedParts: z.array(z.string()).optional(),
    request: z.string(),
  }),
  z.object({ key, kind: z.literal("ideaIcon"), need: iconNeedSchema }),
]);

const producedSchema = z.discriminatedUnion("kind", [
  z.object({
    key,
    kind: z.literal("clip"),
    provenance: z.object({
      generatedAt: z.string(),
      model: z.string(),
      promptVersion: z.string(),
      runId: z.string(),
    }),
    url: z.url(),
  }),
  z.object({ key, kind: z.literal("picture"), mediaAssetId: uuidSchema(), url: z.url() }),
  z.object({ iconId: uuidSchema(), key, kind: z.literal("ideaIcon"), url: z.url() }),
]);

const contentFixMediaSchema = z.array(
  z.object({ need: needSchema, result: z.union([producedSchema, z.literal("failed")]).nullable() }),
);

export type ContentFixMediaNeed = z.infer<typeof needSchema>;
export type ProducedContentFixMedia = z.infer<typeof producedSchema>;
export type ContentFixMedia = z.infer<typeof contentFixMediaSchema>;

export function readContentFixMedia(value: unknown): ContentFixMedia {
  return contentFixMediaSchema.parse(value);
}

export function normalizeContentFixMediaNeed(need: ContentFixMediaNeed): ContentFixMediaNeed {
  return needSchema.parse(
    Object.fromEntries(Object.entries(need).filter(([, value]) => value !== undefined)),
  );
}
