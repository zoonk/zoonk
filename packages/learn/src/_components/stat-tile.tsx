import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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
    <Stat className={className} render={<li />}>
      <StatLabel>
        {icon && <StatIcon className={STAT_TONE[tone]}>{icon}</StatIcon>}
        <span className="truncate">{label}</span>
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

/** The tile's own parts around a blank line each, so a tile takes its loaded height while it loads. */
export function StatTileSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <Stat aria-hidden="true">
      <StatLabel>
        <Skeleton className="w-20 rounded-sm">{"\u00A0"}</Skeleton>
      </StatLabel>
      <StatValue>
        <Skeleton className="w-14 rounded-sm">{"\u00A0"}</Skeleton>
      </StatValue>
      {detail && (
        <StatDetail>
          <Skeleton className="w-28 max-w-full rounded-sm">{"\u00A0"}</Skeleton>
        </StatDetail>
      )}
    </Stat>
  );
}
