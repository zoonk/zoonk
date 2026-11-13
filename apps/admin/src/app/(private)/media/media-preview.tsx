import { type MediaAsset } from "@zoonk/db";
import { cn } from "@zoonk/ui/lib/utils";
import { getPrivateBlobPathname } from "@zoonk/utils/user-blobs";
import { AudioLinesIcon, LockIcon } from "lucide-react";
import Image from "next/image";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1280;

type PreviewAsset = Pick<MediaAsset, "height" | "kind" | "url" | "width"> & {
  prompt?: string | null;
};

/** Every lesson picture is 4 by 5, so a card that holds no picture keeps that shape. */
const CARD_CLASS = "bg-muted aspect-4/5 w-full rounded-lg border";

function MediaTile({ children, icon }: { children: string; icon: React.ReactNode }) {
  return (
    <span
      className={cn(
        CARD_CLASS,
        "text-muted-foreground flex flex-col items-center justify-center gap-2 text-xs [&>svg]:size-6",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * An asset as staff see it: `card` in the gallery, `full` on its own page, where a clip plays.
 * Unoptimized, since assets can live on any host the generator wrote to.
 */
export function MediaPreview({ asset, size }: { asset: PreviewAsset; size: "card" | "full" }) {
  const isCard = size === "card";

  if (asset.kind === "audio") {
    return isCard ? (
      <MediaTile icon={<AudioLinesIcon aria-hidden="true" />}>Audio</MediaTile>
    ) : (
      <audio className="w-full max-w-md" controls preload="none" src={asset.url}>
        <track kind="captions" />
      </audio>
    );
  }

  // A private course's picture is its learner's, readable only with their session.
  if (getPrivateBlobPathname(asset.url)) {
    return isCard ? (
      <MediaTile icon={<LockIcon aria-hidden="true" />}>Private</MediaTile>
    ) : (
      <p className="text-muted-foreground text-sm">
        This picture belongs to one learner and isn&apos;t shown.
      </p>
    );
  }

  return (
    <Image
      alt={asset.prompt ?? ""}
      className={
        isCard
          ? cn(CARD_CLASS, "object-cover")
          : "h-auto max-h-128 w-auto max-w-full rounded-xl border object-contain"
      }
      height={asset.height ?? DEFAULT_HEIGHT}
      src={asset.url}
      unoptimized
      width={asset.width ?? DEFAULT_WIDTH}
    />
  );
}
