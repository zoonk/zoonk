import { cn } from "@zoonk/ui/lib/utils";
import { type GallerySelection } from "../_utils/gallery-params";

const DEVICE_FRAMES = {
  desktop: { height: 860, scale: 0.6, width: 1280 },
  phone: { height: 844, scale: 1, width: 390 },
} as const;

/**
 * A frame drawn at full size narrows with a page that is narrower than it; a scaled one keeps its
 * size and scrolls inside its own border.
 */
export function PreviewFrame({
  device,
  src,
  title,
}: Pick<GallerySelection, "device"> & { src: string; title: string }) {
  const frame = DEVICE_FRAMES[device];
  const isFullSize = frame.scale === 1;

  return (
    <div className="border-border w-fit max-w-full overflow-x-auto rounded-xl border shadow-sm">
      <div
        className={cn("overflow-hidden", isFullSize && "max-w-full")}
        style={{ height: frame.height * frame.scale, width: frame.width * frame.scale }}
      >
        {/* oxlint-disable-next-line react/iframe-missing-sandbox -- The frame is this app's own page, which needs its scripts and origin to load the player. */}
        <iframe
          className="block origin-top-left border-0"
          src={src}
          style={{
            height: frame.height,
            transform: `scale(${frame.scale})`,
            width: isFullSize ? "100%" : frame.width,
          }}
          title={`${title}, ${device}`}
        />
      </div>
    </div>
  );
}
