import { cn } from "@zoonk/ui/lib/utils";
import { BigQuantity } from "./big-quantity";

/**
 * A stat's color, on its icon: what the number counts (Brain Power, Energy, right answers) reads at
 * a glance without a tinted tile around it. Brain Power's number is violet too, as every Brain
 * Power amount reads (`BrainPowerReadout`).
 */
const STAT_TONE = {
  brain: "text-brain",
  danger: "text-destructive",
  energy: "text-energy",
  neutral: "text-muted-foreground",
  success: "text-success",
  // Time is plain data, so neutral: blue is progress made.
  time: "text-muted-foreground",
} as const;

type StatTone = keyof typeof STAT_TONE;

/**
 * A few numbers side by side, each on its own tile (a session's minutes, questions and right
 * answers), two a row, an odd last one across the row. A list, so screen readers count them.
 *
 * ```tsx
 * <StatTiles>
 *   <StatTile icon={<ClockIcon />} label="Time" tone="time" value="49 min" />
 *   <StatTile icon={<TargetIcon />} label="Right" tone="success" value="87%" />
 * </StatTiles>
 * ```
 */
export function StatTiles({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "grid w-full grid-cols-2 gap-2 [&>li:last-child:nth-child(odd)]:col-span-2",
        className,
      )}
      data-slot="stat-tiles"
      {...props}
    />
  );
}

/**
 * One number on its tile, a hairline box: the icon in its color and what it counts as a quiet
 * label on top, the number as a readout under it, Brain Power's in its violet (a quantity with
 * units, "15 hr 1 min" or "90 days", sets its units small and muted, as every readout does), and
 * an optional quiet line ("33% → 35%").
 */
export function StatTile({
  className,
  detail,
  icon,
  label,
  tone = "neutral",
  value,
}: {
  className?: string;
  detail?: React.ReactNode;
  /** Decorative: the label names the number. A tile among plain ones (the Plan's) has none. */
  icon?: React.ReactNode;
  label: string;
  tone?: StatTone;
  value: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "ring-border rounded-option flex min-w-0 flex-col gap-1.5 p-3 text-left ring-1 ring-inset",
        className,
      )}
      data-slot="stat-tile"
    >
      <span className="text-label flex min-w-0 items-center gap-1.5">
        {icon && (
          <span
            aria-hidden="true"
            className={cn("flex shrink-0 [&>svg]:size-3.5", STAT_TONE[tone])}
          >
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>{" "}
      {/* The spaces keep "Questions 20" one phrase for screen readers; the column hides them. */}
      <span
        className={cn("text-readout text-2xl leading-tight", tone === "brain" && "text-brain-text")}
      >
        {typeof value === "string" && /\d/u.test(value) ? (
          <BigQuantity>{value}</BigQuantity>
        ) : (
          value
        )}
      </span>
      {detail && (
        <>
          {" "}
          <span className="text-muted-foreground text-[0.71875rem] leading-snug">{detail}</span>
        </>
      )}
    </li>
  );
}
