"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/** Hyperdrive's multiplier in Fun's lime: right answers in a row multiply the Brain Power earned. */
export function HyperdriveBadge({ className, level }: { className?: string; level: number }) {
  const t = useExtracted();

  return (
    <span
      className={cn(
        "bg-fun-lime text-fun-lime-foreground font-fun-display flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm tabular-nums",
        className,
      )}
      data-slot="lesson-hyperdrive"
    >
      <ZapIcon aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("Hyperdrive")}</span>
      {t("x{level}", { level: String(level) })}
    </span>
  );
}
