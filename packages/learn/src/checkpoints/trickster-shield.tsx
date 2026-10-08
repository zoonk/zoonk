"use client";

import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * The Trickster's shield: one segment per right answer needed to win. Each right answer breaks
 * one, so the pass mark is visible at a glance and a wrong answer never takes anything away. It's
 * the duel's one bar.
 */
export function TricksterShield({ broken, segments }: { broken: number; segments: number }) {
  const t = useExtracted();
  const cracked = Math.min(broken, segments);
  const toGo = segments - cracked;

  return (
    <div className="flex items-center gap-3" data-slot="trickster-shield">
      <Trickster className="size-9" />

      <div
        aria-label={t("The Trickster's shield")}
        aria-valuemax={segments}
        aria-valuemin={0}
        aria-valuenow={cracked}
        aria-valuetext={t("{cracked} of {segments} broken", {
          cracked: String(cracked),
          segments: String(segments),
        })}
        className="flex flex-1 gap-1"
        role="meter"
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              index < cracked ? "bg-muted" : "bg-foreground",
            )}
            key={index}
          />
        ))}
      </div>

      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums"
      >
        {toGo > 0
          ? t("{count, plural, one {# to go} other {# to go}}", { count: toGo })
          : t("Broken")}
      </span>
    </div>
  );
}
