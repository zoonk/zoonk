"use client";

import { Button } from "@zoonk/ui/components/button";
import { Volume2 } from "lucide-react";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";

/** A round speaker button that reads a line aloud; `label` says what it reads. */
export function ActivitySpeakButton({ label, onSpeak }: { label: string; onSpeak: () => void }) {
  return (
    <Button
      aria-label={label}
      className="shrink-0"
      onClick={onSpeak}
      onKeyDown={keepArrowKeys}
      size="icon-lg"
      type="button"
      variant="outline"
    >
      <Volume2 aria-hidden="true" className="size-5" />
    </Button>
  );
}
