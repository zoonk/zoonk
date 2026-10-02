"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { FlameIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * "Often tested": the stop teaches a topic the exam board asks a lot in its past papers. Said
 * only with that evidence, and quietly, so it guides without adding pressure.
 */
export function OftenTestedTag({ className, show }: { className?: string; show: boolean }) {
  const t = useExtracted();

  if (!show) {
    return null;
  }

  return (
    <span
      className={cn(
        "bg-warning/15 text-foreground in-data-[mode=fun]:bg-fun-accent-amber/20 in-data-[mode=fun]:text-fun-fg inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <FlameIcon aria-hidden="true" className="size-3" />
      {t("Often tested")}
    </span>
  );
}
