"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/**
 * The Trickster's shield: one segment per right answer needed to win. Each right answer cracks
 * one, so the pass mark is visible at a glance and wrong answers never take anything away.
 */
export function TricksterShield({ cracked, segments }: { cracked: number; segments: number }) {
  const t = useExtracted();
  const broken = Math.min(cracked, segments);

  return (
    <div
      aria-label={t("Shield")}
      aria-valuemax={segments}
      aria-valuemin={0}
      aria-valuenow={broken}
      aria-valuetext={t("{cracked} of {segments} cracked", {
        cracked: String(broken),
        segments: String(segments),
      })}
      className="flex gap-1.5"
      role="meter"
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          aria-hidden="true"
          className={cn(
            "h-2.5 flex-1 rounded-full transition-[background-color,border-color] duration-300 motion-reduce:transition-none",
            index < broken
              ? "border-fun-dash border border-dashed bg-transparent"
              : "bg-fun-accent-violet shadow-[0_0_10px_-2px_var(--fun-accent-violet)]",
          )}
          key={index}
        />
      ))}
    </div>
  );
}
