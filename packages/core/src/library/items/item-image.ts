import { type MediaAsset } from "@zoonk/db";
import { z } from "zod";

type ItemImageAsset = Pick<MediaAsset, "height" | "url" | "width">;

/**
 * What an item read includes so its question shows its picture: every read that turns bank items
 * into questions a learner sees uses it, so no surface asks about a figure it doesn't show.
 */
export const ITEM_IMAGE_INCLUDE = {
  mediaAsset: { select: { height: true, url: true, width: true } },
} as const;

/** A question's picture as learners see it: the drawn file, with the writer's alt text. */
export const itemImageSchema = z
  .object({
    alt: z.string().meta({ description: "What the picture shows, for screen readers" }),
    height: z.int().nullable(),
    url: z.string(),
    width: z.int().nullable(),
  })
  .meta({ description: "Show it with the question: its words point at it", id: "QuestionImage" });

export type ItemImage = z.infer<typeof itemImageSchema>;

/**
 * The picture a stored question shows, or null without one. Questions about a figure are stored
 * only once their picture is drawn, so a request always comes with its file.
 */
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
