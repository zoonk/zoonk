"use client";

import { ProgressRoot } from "@zoonk/ui/components/progress";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { TASK_COLUMN_CLASS } from "../_components/task-layout";
import { useAppLocale } from "../_utils/locale";

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
  const locale = useAppLocale();
  const toGo = segments - Math.min(broken, segments);
  const won = toGo === 0;
  const lost = !won && held;

  return (
    <div
      className={cn(TASK_COLUMN_CLASS, "flex items-center gap-2.5 pb-1", className)}
      data-slot="trickster-shield"
    >
      <ProgressRoot
        aria-label={label}
        className="sr-only"
        locale={getFormattingLocale(locale)}
        value={Math.min(100, Math.max(0, value))}
      />
      <Trickster className="size-5 shrink-0" />

      <ShieldMeter
        broken={broken}
        className="h-1 flex-1 gap-[3px]"
        plateClassName="h-1"
        segments={segments}
      />

      {/* Every label takes the same cell, so the track never changes width as the words do. */}
      <span
        aria-hidden="true"
        className="text-muted-foreground grid shrink-0 justify-items-end font-mono text-xs whitespace-nowrap tabular-nums *:col-start-1 *:row-start-1"
      >
        <span className={cn(!won && "invisible")}>{t("You won")}</span>
        <span className={cn(!lost && "invisible")}>{t("He won")}</span>
        <span className={cn((won || lost) && "invisible")}>
          {t({
            description: "Right answers the learner still needs to beat the Trickster.",
            message: "{count, plural, one {# more to win} other {# more to win}}",
            values: { count: won ? segments : toGo },
          })}
        </span>
      </span>
    </div>
  );
}

export function TricksterShieldPlates({ broken, segments }: { broken: number; segments: number }) {
  return <ShieldMeter broken={broken} className="gap-1" plateClassName="h-2" segments={segments} />;
}
