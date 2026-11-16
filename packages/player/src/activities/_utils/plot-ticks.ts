/** The room a plot keeps at its start for its value axis's labels. */
export const PLOT_TICK_ROOM = 44;

const TICK_GAP = 6;
const CHARACTER_WIDTH = 7;
const LONGEST_FULL_LABEL = 8;

/**
 * How a chart's value axis writes its ticks. They're written in full, as the readout beside the
 * chart writes the same quantity ("$10,000", not "$10K"), with room made for the longest. Only an
 * axis whose longest tick wouldn't fit shortens them, and then all of them together.
 */
export function tickLabels({
  format,
  ticks,
}: {
  format: (value: number, isShort: boolean) => string;
  ticks: readonly number[];
}): { format: (value: number) => string; isShort: boolean; room: number } {
  const longest = Math.max(0, ...ticks.map((tick) => format(tick, false).length));
  const isShort = longest > LONGEST_FULL_LABEL;

  return {
    format: (value) => format(value, isShort),
    isShort,
    room: isShort ? PLOT_TICK_ROOM : Math.max(PLOT_TICK_ROOM, longest * CHARACTER_WIDTH + TICK_GAP),
  };
}
