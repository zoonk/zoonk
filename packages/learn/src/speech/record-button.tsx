"use client";

import { MS_PER_SECOND } from "@zoonk/utils/date";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { EnterButton } from "../_components/enter-button";
import { formatClock } from "../_utils/clock";

/**
 * Recording as a screen's main action, wherever a learner answers out loud: "Record", then "Stop"
 * with the time, in one button that keeps its place. In a task's bar it sits where Check is.
 */
export function RecordButton({
  busy = false,
  className,
  disabled = false,
  elapsedMs,
  onStart,
  onStop,
  preparation,
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
  preparation: { cancelPreparation: () => void; prepare: () => void };
  recording: boolean;
}) {
  const t = useExtracted();
  const { cancelPreparation, prepare } = preparation;

  useEffect(() => {
    function cancelOnSecondPointer(event: PointerEvent) {
      if (!event.isPrimary) {
        cancelPreparation();
      }
    }

    globalThis.addEventListener("pointerdown", cancelOnSecondPointer, true);
    globalThis.addEventListener("blur", cancelPreparation);

    return () => {
      globalThis.removeEventListener("pointerdown", cancelOnSecondPointer, true);
      globalThis.removeEventListener("blur", cancelPreparation);
      cancelPreparation();
    };
  }, [cancelPreparation]);

  return (
    <EnterButton
      aria-pressed={recording}
      busy={busy}
      className={className}
      data-slot="record-button"
      disabled={disabled}
      onBlur={cancelPreparation}
      onClick={recording ? onStop : onStart}
      onContextMenu={cancelPreparation}
      onPointerCancel={cancelPreparation}
      onPointerDown={(event) => {
        if (!busy && !disabled && !recording && event.isPrimary && event.button === 0) {
          prepare();
        }
      }}
      onPointerLeave={(event) => {
        if (event.buttons !== 0) {
          cancelPreparation();
        }
      }}
      onPointerUp={(event) => {
        // Touch implicitly captures the pointer, even when the finger lifts outside the button.
        if (
          !event.currentTarget.contains(document.elementFromPoint(event.clientX, event.clientY))
        ) {
          cancelPreparation();
        }
      }}
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
