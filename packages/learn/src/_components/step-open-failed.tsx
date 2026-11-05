"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export function StepOpenFailed({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <p className={cn("text-destructive-text text-xs leading-4", className)} role="alert">
      {t("We couldn't open this step. Try again.")}
    </p>
  );
}
