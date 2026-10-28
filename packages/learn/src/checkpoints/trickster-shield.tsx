"use client";

import { ProgressRoot } from "@zoonk/ui/components/progress";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useLocale } from "next-intl";
import { TASK_COLUMN_CLASS } from "../_components/task-layout";

function ShieldMeter({
  broken,
  className,
  plateClassName,
  segments,
}: {
  broken: number;
  className?: string;
  plateClassName?: string;
  segments: number;
}) {
  const t = useExtracted();
  const cracked = Math.min(broken, segments);

  return (
    <div
      aria-label={t("The Trickster's shield")}
      aria-valuemax={segments}
      aria-valuemin={0}
      aria-valuenow={cracked}
      aria-valuetext={t(
        "{cracked, plural, =0 {# of {segments} broken} one {# of {segments} broken} other {# of {segments} broken}}",
        { cracked, segments: String(segments) },
      )}
      className={cn("flex", className)}
      role="meter"
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          aria-hidden="true"
          className={cn(
            "min-w-0 flex-1 rounded-xs transition-colors duration-150 motion-reduce:transition-none",
            index < cracked ? "bg-success" : "bg-surface-3",
            plateClassName,
          )}
          key={index}
        />
      ))}
    </div>
  );
}

export function TricksterShield({
  broken,
  className,
  held,
  label,
  segments,
  value,
}: {
  broken: number;
  className?: string;
  held: boolean;
  label: string;
  segments: number;
  value: number;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const toGo = segments - Math.min(broken, segments);

  return (
    <div
      className={cn(TASK_COLUMN_CLASS, "flex items-center gap-2.5 pb-1", className)}
      data-slot="trickster-shield"
    >
      <ProgressRoot
        aria-label={label}
        className="sr-only"
        locale={locale}
        value={Math.min(100, Math.max(0, value))}
      />
      <Trickster className="size-4 shrink-0" />

      <ShieldMeter
        broken={broken}
        className="h-1 flex-1 gap-[3px]"
        plateClassName="h-1"
        segments={segments}
      />

      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 font-mono text-xs whitespace-nowrap tabular-nums"
      >
        {toGo === 0 && t("Broken")}
        {toGo > 0 && held && t("Held")}
        {toGo > 0 && !held && t("{count, plural, one {# to go} other {# to go}}", { count: toGo })}
      </span>
    </div>
  );
}

export function TricksterShieldPlates({ broken, segments }: { broken: number; segments: number }) {
  return <ShieldMeter broken={broken} className="gap-1" plateClassName="h-2" segments={segments} />;
}
