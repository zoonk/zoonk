import { formatCount } from "@/lib/format";

const MS_PER_SECOND = 1000;
const DURATION_DIGITS = 1;

/** A picture's pixels or a clip's length; nothing when the asset stores neither. */
export function formatMediaSize({
  durationMs,
  height,
  width,
}: {
  durationMs: number | null;
  height: number | null;
  width: number | null;
}): string | null {
  if (width && height) {
    return `${width} × ${height}`;
  }

  return durationMs ? `${(durationMs / MS_PER_SECOND).toFixed(DURATION_DIGITS)} s` : null;
}

export function formatMediaUsage(screens: number): string {
  return screens > 0 ? `On ${formatCount(screens, "screen")}` : "Not used";
}
