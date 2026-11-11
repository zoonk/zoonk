import { cn } from "@zoonk/ui/lib/utils";
import { toMindMapSrc } from "./_utils/mind-map-urls";

const SLOT_CLASS = "flex size-12 shrink-0 items-center justify-center rounded-lg";

/**
 * A row's leading square: the map's picture, or a mark (`children`) where there's none to show.
 * The dashed outline is a chapter map without a picture; `filled` is a map that never has one.
 */
export function MindMapSlot({
  children,
  filled = false,
  thumbnailUrl,
}: {
  children: React.ReactNode;
  filled?: boolean;
  thumbnailUrl: string | null;
}) {
  if (thumbnailUrl) {
    return (
      // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; thumbnails are stored, optimized webp files.
      <img
        alt=""
        className={cn(SLOT_CLASS, "ring-border bg-card object-cover ring-1")}
        decoding="async"
        height={48}
        src={toMindMapSrc(thumbnailUrl)}
        width={48}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(SLOT_CLASS, filled ? "bg-muted" : "border-input border border-dashed")}
      data-slot="mind-map-slot"
    >
      {children}
    </span>
  );
}
