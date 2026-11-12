const TONES = [
  "text-viz-accent",
  "text-viz-secondary",
  "text-viz-highlight",
  "text-viz-series-4",
  "text-viz-series-5",
  "text-viz-series-6",
] as const;

const SHAPES = ["circle", "square", "diamond", "triangle", "cross"] as const;

export type PointShape = (typeof SHAPES)[number];

export type SeriesMark = { open: boolean; shape: PointShape; tone: string };

/**
 * How a chart's series is drawn so it stays apart from the others without relying on color: a
 * line's points take a shape, and once the six colors are used they come back drawn open (outlined
 * bars, dashed lines with hollow points). Six colors and five shapes pair up differently for 30
 * series. The tone sets the text color, which the marks draw in.
 */
export function getSeriesMark(index: number): SeriesMark {
  return {
    open: Math.floor(index / TONES.length) % 2 === 1,
    shape: SHAPES[index % SHAPES.length] ?? SHAPES[0],
    tone: TONES[index % TONES.length] ?? TONES[0],
  };
}
