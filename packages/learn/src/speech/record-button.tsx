"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MicIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { formatClock } from "../_utils/clock";

const MS_PER_SECOND = 1000;

export function RecordButton({
  className,
  disabled = false,
  elapsedMs,
  onStart,
  onStop,
  recording,
}: {
  className?: string;
  disabled?: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  recording: boolean;
}) {
  const t = useExtracted();

  return (
    <Button
      className={cn(recording && "border-foreground border-[1.5px]", className)}
      disabled={disabled}
      // Waiting on the microphone or a check keeps keyboard focus on the button.
      focusableWhenDisabled
      onClick={recording ? onStop : onStart}
      size="lg"
      type="button"
      variant={recording ? "outline" : "default"}
    >
      {recording ? (
        <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
      ) : (
        <MicIcon aria-hidden="true" />
      )}
      {recording ? t("Stop") : t("Record")}
      {recording && (
        // The clock moves every second, so it stays out of the button's name.
        <span aria-hidden="true" className="text-muted-foreground font-mono tabular-nums">
          {formatClock(Math.floor(elapsedMs / MS_PER_SECOND) * MS_PER_SECOND)}
        </span>
      )}
    </Button>
  );
}
