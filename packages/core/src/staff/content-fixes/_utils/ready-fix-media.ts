import { type TransactionClient, sql } from "@zoonk/db";
import { type ContentFixMedia, type ProducedContentFixMedia } from "../media-schema";

async function stillReviewed(
  tx: TransactionClient,
  media: ProducedContentFixMedia,
): Promise<boolean> {
  switch (media.kind) {
    case "clip":
    case "marks":
      return true;
    case "picture": {
      const rows = await tx.$queryRaw<{ id: string }[]>(sql`
        SELECT id FROM media_assets
        WHERE id = ${media.mediaAssetId}::uuid AND url = ${media.url}
          AND check_owed_at IS NULL AND kind = 'image' AND owner_id IS NULL
        FOR SHARE`);

      return rows.length > 0;
    }
    case "ideaIcon": {
      const rows = await tx.$queryRaw<{ id: string }[]>(sql`
        SELECT id FROM lesson_icons
        WHERE id = ${media.iconId}::uuid AND url = ${media.url} AND status = 'completed'
        FOR SHARE`);

      return rows.length > 0;
    }
    default:
      return media satisfies never;
  }
}

export async function readyFixMedia(
  tx: TransactionClient,
  media: ContentFixMedia,
): Promise<Map<string, ProducedContentFixMedia> | null> {
  const entries = await Promise.all(
    media.map(async ({ need, result }) =>
      result &&
      result !== "failed" &&
      result.key === need.key &&
      result.kind === need.kind &&
      (await stillReviewed(tx, result))
        ? ([need.key, result] as const)
        : null,
    ),
  );

  return entries.every((entry) => entry !== null) ? new Map(entries) : null;
}
