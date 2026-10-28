import { cn } from "@zoonk/ui/lib/utils";
import { BigQuantity } from "./big-quantity";

const STAT_TONE = {
  brain: "text-brain",
  danger: "text-destructive",
  energy: "text-energy",
  neutral: "text-muted-foreground",
  success: "text-success",
  time: "text-muted-foreground",
} as const;

type StatTone = keyof typeof STAT_TONE;

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
