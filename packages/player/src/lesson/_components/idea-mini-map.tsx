import { cn } from "@zoonk/ui/lib/utils";
import { getIdeaSlots, getSlotRows } from "../_utils/idea-slots";

const COLUMN_GAP = 14;
const ROW_GAP = 12;
const PAD = 6;
const SCALE = 1.25;

export function IdeaMiniMap({
  className,
  count,
  current,
}: {
  className?: string;
  count: number;
  current: number;
}) {
  const slots = getIdeaSlots(count);
  const rows = getSlotRows(slots);
  const top = rows.first * ROW_GAP - PAD;
  const height = (rows.last - rows.first) * ROW_GAP + PAD * 2;
  const width = COLUMN_GAP * 2 + PAD * 2;

  return (
    <svg
      aria-hidden="true"
      className={cn("text-faint shrink-0 overflow-visible", className)}
      data-slot="idea-mini-map"
      height={height * SCALE}
      viewBox={`${String(-COLUMN_GAP - PAD)} ${String(top)} ${String(width)} ${String(height)}`}
      width={width * SCALE}
    >
      {slots.map((slot, index) => {
        const key = `line-${index}`;

        return (
          <line
            key={key}
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeWidth={1}
            x1={0}
            x2={slot.column * COLUMN_GAP}
            y1={0}
            y2={slot.row * ROW_GAP}
          />
        );
      })}

      <circle cx={0} cy={0} fill="currentColor" r={2} />

      {slots.map((slot, index) => {
        const key = `idea-${index}`;
        const x = slot.column * COLUMN_GAP;
        const y = slot.row * ROW_GAP;

        return index === current ? (
          <g className="text-success" data-current="" key={key}>
            <circle cx={x} cy={y} fill="currentColor" fillOpacity={0.25} r={6} />
            <circle cx={x} cy={y} fill="currentColor" r={3.5} />
          </g>
        ) : (
          <circle cx={x} cy={y} fill="currentColor" key={key} r={3} />
        );
      })}
    </svg>
  );
}
