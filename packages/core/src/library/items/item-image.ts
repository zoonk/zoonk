import { type MediaAsset } from "@zoonk/db";
import { z } from "zod";

type ItemImageAsset = Pick<MediaAsset, "height" | "url" | "width">;

export const ITEM_IMAGE_INCLUDE = {
  mediaAsset: { select: { height: true, url: true, width: true } },
} as const;

export const itemImageSchema = z
  .object({
    alt: z.string().meta({ description: "What the picture shows, for screen readers" }),
    height: z.int().nullable(),
    url: z.string(),
    width: z.int().nullable(),
  })
  .meta({ description: "Show it with the question: its words point at it", id: "QuestionImage" });

export type ItemImage = z.infer<typeof itemImageSchema>;

/** A failed picture check can remove a question's picture after a learner was given it. */
export function isMissingItsPicture(item: { content: object; image?: ItemImage | null }): boolean {
  return "image" in item.content && Boolean(item.content.image) && !item.image;
}

export function toItemImage({
  content,
  mediaAsset,
}: {
  content: { image?: { alt: string } | null };
  mediaAsset?: ItemImageAsset | null;
}): ItemImage | null {
  const alt = content.image?.alt;

  return mediaAsset && alt
    ? { alt, height: mediaAsset.height, url: mediaAsset.url, width: mediaAsset.width }
    : null;
}
