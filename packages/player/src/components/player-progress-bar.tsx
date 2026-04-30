"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export function PlayerProgressBar({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "value"> & { value: number }) {
  const t = useExtracted();

  return (
    <ProgressRoot
      aria-label={t("Lesson progress")}
      className={cn("gap-0", className)}
      data-slot="player-progress-bar"
      value={value}
      {...props}
    >
      <ProgressTrack className="h-1 rounded-none">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
