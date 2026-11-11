const SERIES_TONES = [
  { fill: "fill-viz-accent", stroke: "stroke-viz-accent", swatch: "bg-viz-accent" },
  { fill: "fill-viz-secondary", stroke: "stroke-viz-secondary", swatch: "bg-viz-secondary" },
  { fill: "fill-viz-highlight", stroke: "stroke-viz-highlight", swatch: "bg-viz-highlight" },
] as const;

export function getTone(index: number) {
  return SERIES_TONES[index % SERIES_TONES.length] ?? SERIES_TONES[0];
}
