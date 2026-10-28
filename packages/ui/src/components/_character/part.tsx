export type PartPose = {
  opacity?: number;
  rotate?: number;
  scale?: number | readonly [x: number, y: number];
  translate?: readonly [x: number, y: number];
};

type Pivot = readonly [x: number, y: number];

function formatScale(scale: NonNullable<PartPose["scale"]>): string {
  return typeof scale === "number" ? String(scale) : `${scale[0]} ${scale[1]}`;
}

/** Never put an SVG `transform` attribute on the same element: it doesn't compose with these. */
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
