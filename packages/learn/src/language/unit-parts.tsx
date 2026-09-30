"use client";

import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { MapPinnedIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useExperienceMode } from "../mode-provider";
import { FunMoon } from "../plan/fun-moon";

const PERCENT = 100;

/**
 * A unit's mark: a place pin in Focus (every unit is a real situation) and its moon on the route
 * in Fun, colored by its position like the route draws it.
 */
export function UnitBadge({
  position,
  size = "md",
}: {
  position: number | null;
  size?: "lg" | "md";
}) {
  const mode = useExperienceMode();

  if (mode === "fun") {
    return <FunMoon index={(position ?? 1) - 1} size={size} />;
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-muted-foreground flex shrink-0 items-center justify-center",
        size === "lg" ? "size-16 rounded-3xl" : "size-11 rounded-2xl",
      )}
    >
      <MapPinnedIcon className={size === "lg" ? "size-7" : "size-5"} />
    </span>
  );
}

/** A thin bar of lessons done, with "4 of 9 lessons" beside it. */
export function UnitLessonsBar({ done, total }: { done: number; total: number }) {
  const t = useExtracted();
  const locale = useLocale();

  const label = t(
    "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
    { done, total },
  );

  return (
    <div className="flex items-center gap-3">
      <Progress
        locale={locale}
        aria-label={label}
        className="flex-1 **:data-[slot=progress-track]:h-1.5"
        value={total > 0 ? (done / total) * PERCENT : 0}
      />
      <span aria-hidden="true" className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {label}
      </span>
    </div>
  );
}
