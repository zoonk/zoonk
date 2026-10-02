"use client";

import { rhythmHitSteps, rhythmStepMs, rhythmTapTimes } from "@zoonk/core/library/activities/music";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { RhythmControls, RhythmStatus } from "./rhythm-controls";
import { RhythmDelayCalibration } from "./rhythm-delay-calibration";
import { RhythmFeedback } from "./rhythm-feedback";
import { RhythmGrid } from "./rhythm-grid";
import { rhythmResults } from "./rhythm-results";
import { RhythmTapPad } from "./rhythm-tap-pad";
import { useDeviceDelay } from "./use-device-delay";
import { useRhythmRun } from "./use-rhythm-run";
import { useSpaceToTap } from "./use-space-to-tap";

type RhythmTapperProps = ActivityRendererProps<"rhythmTapper">;

/** How each hit went, judged against core's expected tap times. */
function tapResults({
  deviceDelayMs,
  expected,
  fields,
  taps,
}: {
  deviceDelayMs?: number;
  expected: RhythmTapperProps["expected"];
  fields: RhythmTapperProps["content"]["fields"];
  taps: readonly number[];
}) {
  const expectedMs = expectedInteraction(expected, "rhythm")?.tapTimesMs ?? rhythmTapTimes(fields);

  return rhythmResults({
    beatMs: rhythmStepMs(fields) * fields.stepsPerBeat,
    deviceDelayMs,
    expectedMs,
    tapsMs: taps,
    toleranceMs: fields.toleranceMs,
  });
}

/**
 * The rhythm itself, with the device's measured delay: its taps go to core with that delay, and
 * the dots show the same judgment per tap.
 */
function RhythmTapperRun({
  deviceDelayMs,
  onCalibrate,
  props,
}: {
  deviceDelayMs?: number;
  onCalibrate: () => void;
  props: RhythmTapperProps;
}) {
  const t = useExtracted();
  const { answer, content, expected, labelId, onAnswerChange, phase } = props;
  const { fields } = content;
  const isChecked = phase === "checked";
  const padRef = useRef<HTMLButtonElement>(null);

  const run = useRhythmRun({
    fields,
    onFinish: (taps) =>
      onAnswerChange(
        taps.length > 0
          ? {
              kind: "rhythm",
              tapTimesMs: taps,
              ...(deviceDelayMs === undefined ? {} : { deviceDelayMs }),
            }
          : null,
      ),
  });

  const isRunning = run.phase === "countIn" || run.phase === "tapping";
  const answeredTaps = answer?.kind === "rhythm" ? answer.tapTimesMs : null;
  const taps = run.phase === "idle" || run.phase === "done" ? answeredTaps : null;

  const results = taps ? tapResults({ deviceDelayMs, expected, fields, taps }) : null;

  useSpaceToTap({ enabled: isRunning && !isChecked, onTap: run.tap });

  async function startTapping() {
    onAnswerChange(null);
    await run.start("tap");
    padRef.current?.focus();
  }

  const hits = rhythmHitSteps(fields.pattern).map((step) => String(step + 1));

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <RhythmStatus
        round={run.phase === "tapping" && run.position ? run.position.round + 1 : null}
        rounds={fields.rounds}
        tempo={fields.tempo}
      />

      <RhythmGrid
        pattern={fields.pattern}
        position={run.position}
        results={results?.hits ?? null}
        rounds={fields.rounds}
        stepsPerBeat={fields.stepsPerBeat}
      />

      {!isChecked && (
        <RhythmTapPad
          isActive={isRunning}
          isCountingIn={run.phase === "countIn"}
          onTap={run.tap}
          ref={padRef}
        />
      )}

      {!isChecked && !isRunning && run.phase !== "listening" && (
        <RhythmControls
          hasTried={taps !== null}
          onCalibrate={onCalibrate}
          onListen={() => void run.start("listen")}
          onStart={() => void startTapping()}
        />
      )}

      {results && <RhythmFeedback extraTaps={results.extraTaps} hits={results.hits} />}

      <ActivityTextAlternative>
        {t(
          "A rhythm of {length} steps with a beat every {perBeat}. Tap on steps {hits}, over a click on every beat.",
          {
            hits: hits.join(", "),
            length: String(fields.pattern.length),
            perBeat: String(fields.stepsPerBeat),
          },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

/**
 * Tap a rhythm over a steady click, timed by the device (no microphone). The first rhythm on a
 * device starts with a sound check that measures the delay its headphones or speakers add. Then
 * listen first to hear the rhythm, a bar counts in and every round is timed. The answer is the
 * taps with that delay, which core grades after taking it out.
 */
export function RhythmTapperActivity(props: RhythmTapperProps) {
  const device = useDeviceDelay();
  const [isCalibrating, setIsCalibrating] = useState(false);
  const isChecked = props.phase === "checked";

  if (!isChecked && (device.delay.status === "unset" || isCalibrating)) {
    return (
      <ActivityCanvas className="gap-4" labelId={props.labelId}>
        <RhythmDelayCalibration
          onDone={(delayMs) => {
            device.save(delayMs);
            setIsCalibrating(false);
          }}
          onSkip={() => {
            device.skip();
            setIsCalibrating(false);
          }}
        />
      </ActivityCanvas>
    );
  }

  return (
    <RhythmTapperRun
      deviceDelayMs={device.delay.status === "set" ? device.delay.delayMs : undefined}
      onCalibrate={() => {
        props.onAnswerChange(null);
        setIsCalibrating(true);
      }}
      props={props}
    />
  );
}
