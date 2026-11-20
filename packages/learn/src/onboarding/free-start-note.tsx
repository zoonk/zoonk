"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export function FreeStartNote({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <p className={cn("text-muted-foreground text-xs text-pretty", className)}>
      {t("Start free, no account needed.")}
    </p>
  );
}
