"use client";

import { type SpokenAudioState } from "@zoonk/learn/speech";
import { SpeechStatusIcon, useSpeechActionLabel } from "@zoonk/learn/speech/parts";
import { Button } from "@zoonk/ui/components/button";
import { Volume2 } from "lucide-react";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";

export function ActivitySpeakButton({
  label,
  onClick,
  state,
}: {
  label: string;
  onClick: () => void;
  state: SpokenAudioState;
}) {
  const name = useSpeechActionLabel(state, label);

  return (
    <Button
      aria-busy={state.status === "loading"}
      aria-label={name}
      className="shrink-0"
      onClick={onClick}
      onKeyDown={keepArrowKeys}
      size="icon-lg"
      type="button"
      variant="outline"
    >
      <SpeechStatusIcon idle={<Volume2 aria-hidden="true" className="size-5" />} state={state} />
    </Button>
  );
}
