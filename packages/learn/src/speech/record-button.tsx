"use client";

import { MS_PER_SECOND } from "@zoonk/utils/date";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { formatClock } from "../_utils/clock";
import { useSpeechPlayer } from "./speech-player-provider";

/**
 * Recording as a screen's main action, wherever a learner answers out loud: "Record", then "Stop"
 * with the time, in one button that keeps its place. In a task's bar it sits where Check is.
 * Record silences any example still playing, so the take holds only the learner.
 */
export function RecordButton({
  busy = false,
  className,
  disabled = false,
  elapsedMs,
  onStart,
  onStop,
  recording,
  size,
}: Pick<React.ComponentProps<typeof EnterButton>, "size"> & {
  /** Waiting for the microphone. */
  busy?: boolean;
  className?: string;
  disabled?: boolean;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  recording: boolean;
}) {
  const t = useExtracted();
  const speech = useSpeechPlayer();

  const start = () => {
    speech?.silence();
    onStart();
  };

  return (
    <EnterButton
      aria-pressed={recording}
      busy={busy}
      className={className}
      data-slot="record-button"
      disabled={disabled}
      onClick={recording ? onStop : start}
      size={size}
    >
      {recording
        ? t({
            description: "Stops a recording. Hints tell the learner to press it by this name.",
            message: "Stop",
          })
        : t({
            description: "Starts a recording. Hints tell the learner to press it by this name.",
            message: "Record",
          })}
      {recording && (
        // The clock moves every second, so it stays out of the button's name.
        <span aria-hidden="true" className="font-mono text-sm tabular-nums opacity-70">
          {formatClock(Math.floor(elapsedMs / MS_PER_SECOND) * MS_PER_SECOND)}
        </span>
      )}
    </EnterButton>
  );
}
