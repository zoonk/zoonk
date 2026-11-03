"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** Under a question answered with a guess, before the answer shows. */
export function GuessHint({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <p className={cn("text-muted-foreground text-sm text-pretty", className)}>
      {t("Getting it wrong now helps you remember later.")}
    </p>
  );
}
