import { cn } from "@zoonk/ui/lib/utils";
import { type GuitarVoicing } from "../_utils/guitar-voicing";

const STRINGS = 6;
const FRETS = 4;
const WIDTH = 60;
const HEIGHT = 64;
const LEFT = 8;
const TOP = 12;
const BOTTOM = 4;
const NUT_WIDTH = 3;
const LINE_WIDTH = 1.2;
const STRING_GAP = (WIDTH - LEFT * 2) / (STRINGS - 1);
const FRET_GAP = (HEIGHT - TOP - BOTTOM) / FRETS;
const DOT_RADIUS = 3.6;
const MARK_Y = 5;
const MARK_SIZE = 2.6;
const HALF = 0.5;
const STRING_INDEXES = Array.from({ length: STRINGS }, (_, index) => index);
const FRET_LINES = Array.from({ length: FRETS + 1 }, (_, index) => index);

function stringX(index: number): number {
  return LEFT + index * STRING_GAP;
}

/** The first fret a small diagram starts at, so a shape up the neck still fits. */
function firstFret(voicing: GuitarVoicing): number {
  const fretted = voicing.filter((fret): fret is number => fret !== null && fret > 0);
  const highest = Math.max(0, ...fretted);

  return highest <= FRETS ? 1 : Math.min(...fretted);
}

/**
 * A small chord box the way guitar songbooks print them: strings up and down, the nut on top,
 * dots for fingers, "o" for open strings and "x" for strings not played. Decorative: the chord's
 * name next to it says the same in words.
 */
export function ChordDiagram({
  className,
  voicing,
}: {
  className?: string;
  voicing: GuitarVoicing;
}) {
  const start = firstFret(voicing);

  return (
    <svg
      aria-hidden="true"
      className={cn("h-16 w-15 shrink-0", className)}
      data-slot="chord-diagram"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <g className="stroke-current opacity-50" strokeWidth={1}>
        {STRING_INDEXES.map((string) => (
          <line
            key={string}
            x1={stringX(string)}
            x2={stringX(string)}
            y1={TOP}
            y2={HEIGHT - BOTTOM}
          />
        ))}
        {FRET_LINES.map((line) => (
          <line
            key={line}
            strokeWidth={line === 0 && start === 1 ? NUT_WIDTH : 1}
            x1={LEFT}
            x2={WIDTH - LEFT}
            y1={TOP + line * FRET_GAP}
            y2={TOP + line * FRET_GAP}
          />
        ))}
      </g>

      {STRING_INDEXES.map((string) => {
        const fret = voicing[string] ?? null;
        const x = stringX(string);

        if (fret === null) {
          return (
            <path
              className="stroke-current"
              d={`M${x - MARK_SIZE} ${MARK_Y - MARK_SIZE}L${x + MARK_SIZE} ${MARK_Y + MARK_SIZE}M${x + MARK_SIZE} ${MARK_Y - MARK_SIZE}L${x - MARK_SIZE} ${MARK_Y + MARK_SIZE}`}
              key={string}
              strokeWidth={LINE_WIDTH}
            />
          );
        }

        if (fret === 0) {
          return (
            <circle
              className="fill-none stroke-current"
              cx={x}
              cy={MARK_Y}
              key={string}
              r={MARK_SIZE}
              strokeWidth={LINE_WIDTH}
            />
          );
        }

        return (
          <circle
            className="fill-current"
            cx={x}
            cy={TOP + (fret - start + HALF) * FRET_GAP}
            key={string}
            r={DOT_RADIUS}
          />
        );
      })}
    </svg>
  );
}
