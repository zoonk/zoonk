"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useLocale } from "next-intl";

/** Uses the app locale so assistive progress text matches the lesson language. */
export function PlayerProgressBar({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "value"> & { value: number }) {
  const t = useExtracted();
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={t("Lesson progress")}
      className={cn("gap-0", className)}
      data-slot="player-progress-bar"
      locale={locale}
      value={value}
      {...props}
    >
      <ProgressTrack className="h-1 rounded-none">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
