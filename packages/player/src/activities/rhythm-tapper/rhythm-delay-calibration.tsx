"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { CALIBRATION_CLICKS } from "./rhythm-calibration";
import { RhythmTapPad } from "./rhythm-tap-pad";
import { type CalibrationPhase, useDelayCalibration } from "./use-delay-calibration";
import { useSpaceToTap } from "./use-space-to-tap";

/** A reading this close to zero is a device with no delay worth mentioning. */
const ON_TIME_MS = 20;

function CalibrationStatus({ phase }: { phase: CalibrationPhase }) {
  const t = useExtracted();

  if (phase.kind === "countIn") {
    return t("Listen to the clicks…");
  }

  if (phase.kind === "tapping") {
    return t("Tap with each click · {click} of {total}", {
      click: String(Math.min(phase.click, CALIBRATION_CLICKS)),
      total: String(CALIBRATION_CLICKS),
    });
  }

  if (phase.kind === "done" && phase.delayMs === null) {
    return t("We couldn't match enough taps to the clicks. Try again, tapping with each one.");
  }

  if (phase.kind === "done" && phase.delayMs !== null) {
    return phase.delayMs < ON_TIME_MS
      ? t("Sound on this device arrives on time.")
      : t("Sound on this device arrives about {ms} ms late. Rhythms here take that out.", {
          ms: String(phase.delayMs),
        });
  }

  return t(
    "Headphones can play sound a little late. Tap along with {count} clicks once, and rhythms on this device are timed fairly.",
    { count: String(CALIBRATION_CLICKS) },
  );
}

/**
 * The one-time sound check before the first rhythm on a device: the learner taps along with
 * steady clicks, and the delay the device adds (Bluetooth headphones add up to half a second) is
 * taken out of every rhythm after. It can be skipped, and redone from any rhythm.
 */
export function RhythmDelayCalibration({
  onDone,
  onSkip,
}: {
  onDone: (delayMs: number) => void;
  onSkip: () => void;
}) {
  const t = useExtracted();
  const calibration = useDelayCalibration();
  const padRef = useRef<HTMLButtonElement>(null);
  const { phase } = calibration;
  const isRunning = phase.kind === "countIn" || phase.kind === "tapping";
  const reading = phase.kind === "done" ? phase.delayMs : null;

  useSpaceToTap({ enabled: isRunning, onTap: calibration.tap });

  async function start() {
    await calibration.start();
    padRef.current?.focus();
  }

  return (
    <section aria-labelledby="rhythm-delay-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold" id="rhythm-delay-title">
          {t("Set up your sound")}
        </h3>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          <CalibrationStatus phase={phase} />
        </p>
      </div>

      <RhythmTapPad
        isActive={isRunning}
        isCountingIn={phase.kind === "countIn"}
        onTap={calibration.tap}
        ref={padRef}
      />

      {!isRunning && (
        <div className="flex flex-wrap gap-2">
          {reading === null ? (
            <Button onClick={() => void start()} size="lg" type="button">
              {phase.kind === "done" ? t("Try again") : t("Start the sound check")}
            </Button>
          ) : (
            <Button onClick={() => onDone(reading)} size="lg" type="button">
              {t("Continue")}
            </Button>
          )}

          {reading === null && (
            <Button onClick={onSkip} size="lg" type="button" variant="ghost">
              {t("Skip for now")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
