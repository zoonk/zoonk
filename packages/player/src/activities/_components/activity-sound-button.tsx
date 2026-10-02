"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Volume2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { type InstrumentStatus } from "../_utils/use-instrument";

/** An outlined "Hear it" button: plays a sound the canvas shows. */
export function ActivitySoundButton({
  children,
  className,
  disabled,
  onPlay,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onPlay: () => void;
}) {
  return (
    <Button
      className={cn("rounded-full", className)}
      disabled={disabled}
      onClick={onPlay}
      size="lg"
      type="button"
      variant="outline"
    >
      <Volume2 aria-hidden="true" data-icon="inline-start" />
      {children}
    </Button>
  );
}

/** Says when the instrument sounds couldn't load, so silence isn't mistaken for a broken key. */
export function ActivitySoundNote({ status }: { status: InstrumentStatus }) {
  const t = useExtracted();

  if (status !== "unavailable") {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm" role="status">
      {t("The sound couldn't load. You can still see every note.")}
    </p>
  );
}
