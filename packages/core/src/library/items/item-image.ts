import { type MediaAsset } from "@zoonk/db";

type ItemImageAsset = Pick<MediaAsset, "height" | "url" | "width">;

/**
 * What an item read includes so its question shows its picture: every read that turns bank items
 * into questions a learner sees uses it, so no surface asks about a figure it doesn't show.
 */
export const ITEM_IMAGE_INCLUDE = {
  mediaAsset: { select: { height: true, url: true, width: true } },
} as const;

/** A question's picture as learners see it: the drawn file, with the writer's alt text. */
export type ItemImage = { alt: string; height: number | null; url: string; width: number | null };

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
