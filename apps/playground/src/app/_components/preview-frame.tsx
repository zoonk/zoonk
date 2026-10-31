import { type GallerySelection } from "../_utils/gallery-params";

const DEVICE_FRAMES = {
  desktop: { height: 860, scale: 0.6, width: 1280 },
  phone: { height: 844, scale: 1, width: 390 },
} as const;

export function PreviewFrame({
  device,
  src,
  title,
}: Pick<GallerySelection, "device"> & { src: string; title: string }) {
  const frame = DEVICE_FRAMES[device];

  return (
    <div
      className="border-border overflow-hidden rounded-xl border shadow-sm"
      style={{ height: frame.height * frame.scale, width: frame.width * frame.scale }}
    >
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- The frame is this app's own page, which needs its scripts and origin to load the player. */}
      <iframe
        className="block origin-top-left border-0"
        src={src}
        style={{ height: frame.height, transform: `scale(${frame.scale})`, width: frame.width }}
        title={`${title}, ${device}`}
      />
    </div>
  );
}
