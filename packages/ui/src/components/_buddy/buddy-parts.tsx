import { cn } from "@zoonk/ui/lib/utils";

/**
 * Ids inside an inline SVG are document-global. Each buddy prefixes its gradients
 * and clip paths with a per-instance id so several buddies can share a page, even
 * when one of them is hidden with `display: none`.
 */
export function buddyDefId(uid: string, name: string): string {
  return `${uid}-${name}`;
}

export function buddyDefUrl(uid: string, name: string): string {
  return `url(#${buddyDefId(uid, name)})`;
}

/** The belt color comes from the `--buddy-belt` variable set on the buddy's root. */
export const BELT_FILL = { fill: "var(--buddy-belt)" } as const;

/** What every body needs to draw its Energy glow and its napping pose. */
export type BuddyBodyProps = { glow: number; isGlowing: boolean; isNapping: boolean; uid: string };

const SPARK_PATH = "M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z";
const SPARK_BOX = 24;

export function Spark({
  fill,
  opacity,
  size,
  x,
  y,
}: {
  fill: string;
  opacity?: number;
  size: number;
  x: number;
  y: number;
}) {
  return (
    <path
      d={SPARK_PATH}
      fill={fill}
      opacity={opacity}
      transform={`translate(${x} ${y}) scale(${size / SPARK_BOX})`}
    />
  );
}

/** Orange Energy halo shared by every buddy; each buddy places it on its own glowing part. */
export function BuddyHaloGradient({ uid }: { uid: string }) {
  return (
    <radialGradient id={buddyDefId(uid, "halo")}>
      <stop offset="0" stopColor="#ffb35c" stopOpacity=".95" />
      <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
    </radialGradient>
  );
}

/** How much larger than its base radius a halo grows at full Energy. */
const HALO_GROWTH = 1.5;

/**
 * The Energy glow: brighter and wider as Energy rises and, at full Energy, a
 * gentle pulse that stops when the learner prefers reduced motion.
 */
export function BuddyHalo({
  cx,
  cy,
  glow,
  isGlowing,
  radius,
  uid,
}: {
  cx: number;
  cy: number;
  glow: number;
  isGlowing: boolean;
  radius: number;
  uid: string;
}) {
  return (
    <g opacity={glow}>
      <circle
        className={cn(isGlowing && "animate-fun-glow")}
        cx={cx}
        cy={cy}
        fill={buddyDefUrl(uid, "halo")}
        r={radius * (1 + HALO_GROWTH * glow)}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </g>
  );
}
