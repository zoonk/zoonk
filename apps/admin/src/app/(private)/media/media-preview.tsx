import { type MediaAsset } from "@zoonk/db";
import { getPrivateBlobPathname } from "@zoonk/utils/user-blobs";
import Image from "next/image";

const THUMBNAIL_SIZE = 48;
const DEFAULT_PREVIEW_SIZE = 320;

/** Lists omit the prompt, so it is optional; the detail page uses it as the image's alt text. */
type PreviewAsset = Pick<MediaAsset, "height" | "kind" | "url" | "width"> & {
  prompt?: string | null;
};

/**
 * Images render as-is (unoptimized) because assets can live on any host the
 * generator wrote to. Audio gets a native player.
 */
export function MediaPreview({ asset, size }: { asset: PreviewAsset; size: "full" | "thumbnail" }) {
  const src = asset.url;

  if (asset.kind === "audio") {
    return (
      <audio
        className={size === "thumbnail" ? "w-40" : "w-full max-w-md"}
        controls
        preload="none"
        src={src}
      >
        <track kind="captions" />
      </audio>
    );
  }

  const isThumbnail = size === "thumbnail";

  // A private course's picture is its learner's, readable only with their session.
  if (getPrivateBlobPathname(asset.url)) {
    return (
      <span
        className={
          isThumbnail
            ? "text-muted-foreground flex size-12 items-center justify-center rounded-md border text-xs"
            : "text-muted-foreground text-sm"
        }
      >
        Private
      </span>
    );
  }

  const width = isThumbnail ? THUMBNAIL_SIZE : (asset.width ?? DEFAULT_PREVIEW_SIZE);
  const height = isThumbnail ? THUMBNAIL_SIZE : (asset.height ?? DEFAULT_PREVIEW_SIZE);

  return (
    <Image
      alt={asset.prompt ?? ""}
      className={
        isThumbnail
          ? "size-12 rounded-md border object-cover"
          : "h-auto max-h-96 w-auto max-w-full rounded-lg border object-contain"
      }
      height={height}
      src={src}
      unoptimized
      width={width}
    />
  );
}
