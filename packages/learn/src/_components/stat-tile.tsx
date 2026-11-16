import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { Stat, StatDetail, StatIcon, StatLabel, StatValue } from "@zoonk/ui/components/stat";
import { cn } from "@zoonk/ui/lib/utils";

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
        "grid w-full auto-rows-fr grid-cols-2 gap-2 [&>li:last-child:nth-child(odd)]:col-span-2",
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
  opens = false,
  tone = "neutral",
  value,
}: {
  className?: string;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  label: string;
  /** The tile opens the number's own page, so it ends its label as a row that opens one does. */
  opens?: boolean;
  tone?: StatTone;
  value: React.ReactNode;
}) {
  return (
    <Stat className={className} render={<li />}>
      <StatLabel>
        {icon && <StatIcon className={STAT_TONE[tone]}>{icon}</StatIcon>}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {opens && <RowChevron />}
      </StatLabel>{" "}
      {/* The spaces keep "Questions 20" one phrase for screen readers; the column hides them. */}
      <StatValue className={cn(tone === "brain" && "text-brain-text")}>
        {typeof value === "string" && /\d/u.test(value) ? (
          <BigQuantity>{value}</BigQuantity>
        ) : (
          value
        )}
      </StatValue>
      {detail && (
        <>
          {" "}
          <StatDetail>{detail}</StatDetail>
        </>
      )}
    </Stat>
  );
}
