type BoardTone = "accent" | "highlight" | "neutral" | "secondary";

export const BOARD_TONES: Record<
  BoardTone,
  { ink: string; mark: string; soft: string; text: string }
> = {
  accent: {
    ink: "text-viz-accent",
    mark: "fill-viz-accent-soft stroke-viz-accent",
    soft: "fill-viz-accent-soft/70 stroke-viz-accent",
    text: "fill-viz-accent",
  },
  highlight: {
    ink: "text-viz-highlight",
    mark: "fill-viz-highlight-soft stroke-viz-highlight",
    soft: "fill-viz-highlight-soft/70 stroke-viz-highlight",
    text: "fill-viz-highlight",
  },
  neutral: {
    ink: "text-foreground",
    mark: "fill-muted stroke-muted-foreground",
    soft: "fill-muted/70 stroke-muted-foreground",
    text: "fill-foreground",
  },
  secondary: {
    ink: "text-viz-secondary",
    mark: "fill-viz-secondary-soft stroke-viz-secondary",
    soft: "fill-viz-secondary-soft/70 stroke-viz-secondary",
    text: "fill-viz-secondary",
  },
};

const SEQUENCE: readonly BoardTone[] = ["accent", "highlight", "secondary", "neutral"];

export function cornerTone(index: number, count: number): BoardTone {
  const tone = SEQUENCE[index % SEQUENCE.length] ?? "accent";
  const wrapsOntoFirst = index === count - 1 && index % SEQUENCE.length === 0 && index > 0;

  return wrapsOntoFirst ? "secondary" : tone;
}

export function squareTone({
  index,
  totalIndex,
}: {
  index: number;
  totalIndex: number | null;
}): BoardTone {
  if (index === totalIndex) {
    return "highlight";
  }

  return index === 0 || (totalIndex === 0 && index === 1) ? "accent" : "secondary";
}
