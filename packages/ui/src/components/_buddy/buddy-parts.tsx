/** Ids inside an inline SVG are document-global, so each buddy prefixes its own. */
export function buddyDefId(uid: string, name: string): string {
  return `${uid}-${name}`;
}

export function buddyDefUrl(uid: string, name: string): string {
  return `url(#${buddyDefId(uid, name)})`;
}

export const BELT_FILL = { fill: "var(--buddy-belt)" } as const;

export type BuddyBodyProps = {
  face: React.ReactNode;
  glow: number;
  isNapping: boolean;
  uid: string;
};

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

export function BuddyHaloGradient({ uid }: { uid: string }) {
  return (
    <radialGradient id={buddyDefId(uid, "halo")}>
      <stop offset="0" stopColor="#ffb35c" stopOpacity=".95" />
      <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
    </radialGradient>
  );
}

const HALO_GROWTH = 1.5;

/** Holds still: the buddy shows on everyday screens, where nothing loops. */
export function BuddyHalo({
  cx,
  cy,
  glow,
  radius,
  uid,
}: {
  cx: number;
  cy: number;
  glow: number;
  radius: number;
  uid: string;
}) {
  return (
    <g opacity={glow}>
      <circle
        cx={cx}
        cy={cy}
        fill={buddyDefUrl(uid, "halo")}
        r={radius * (1 + HALO_GROWTH * glow)}
      />
    </g>
  );
}
