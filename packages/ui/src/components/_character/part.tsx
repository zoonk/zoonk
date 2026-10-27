/**
 * Characters (the buddy, the Trickster) are drawn as parts, so they act the way a person does:
 * their eyes, lids, brows, mouth and limbs move, never the whole drawing at once. A part turns,
 * stretches and moves around its own pivot, in the character's drawing units.
 */

/**
 * Where a part sits when it isn't at rest: its turn in degrees, its stretch, its move, and how
 * much of it shows.
 */
export type PartPose = {
  opacity?: number;
  rotate?: number;
  scale?: number | readonly [x: number, y: number];
  translate?: readonly [x: number, y: number];
};

/** The point a part turns and stretches around, in the character's drawing units. */
type Pivot = readonly [x: number, y: number];

function formatScale(scale: NonNullable<PartPose["scale"]>): string {
  return typeof scale === "number" ? String(scale) : `${scale[0]} ${scale[1]}`;
}

/**
 * The part's pose as CSS's own transform properties, which an act animates (`rotate`, `scale`,
 * `translate`) without touching the drawing's attributes. A part at rest only sets its pivot, so
 * it draws exactly as before. Never put an SVG `transform` attribute on the same element: the two
 * don't compose.
 */
function partStyle(pivot: Pivot, pose?: PartPose): React.CSSProperties {
  return {
    opacity: pose?.opacity,
    rotate: pose?.rotate === undefined ? undefined : `${pose.rotate}deg`,
    scale: pose?.scale === undefined ? undefined : formatScale(pose.scale),
    transformOrigin: `${pivot[0]}px ${pivot[1]}px`,
    translate:
      pose?.translate === undefined ? undefined : `${pose.translate[0]}px ${pose.translate[1]}px`,
  };
}

/**
 * One named part of a character, the handle an act moves by its `data-part`. A `hidden` part (a
 * closed lid's line) draws nothing until an act shows it.
 */
export function Part({
  children,
  hidden = false,
  name,
  pivot,
  pose,
}: {
  children: React.ReactNode;
  hidden?: boolean;
  name: string;
  pivot: Pivot;
  pose?: PartPose;
}) {
  return (
    <g data-part={name} opacity={hidden ? 0 : undefined} style={partStyle(pivot, pose)}>
      {children}
    </g>
  );
}
