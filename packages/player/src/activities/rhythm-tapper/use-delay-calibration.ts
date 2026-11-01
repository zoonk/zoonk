"use client";

import { estimateDeviceDelay } from "@zoonk/core/library/activities/music";
import { useEffect, useRef, useState } from "react";
import { scheduleClick, silenceClicks, startActivityAudio } from "../_utils/activity-audio";
import {
  CALIBRATION_CLICKS,
  CALIBRATION_COUNT_IN,
  CALIBRATION_INTERVAL_MS,
} from "./rhythm-calibration";
import { heardAtMs } from "./rhythm-clock";

const LEAD_IN_SECONDS = 0.15;
const MS = 1000;

export type CalibrationPhase =
  | { click: number; kind: "tapping" }
  | { delayMs: number | null; kind: "done" }
  | { kind: "countIn" }
  | { kind: "idle" };

type Run = {
  clicks: OscillatorNode[];
  clicksMs: number[];
  context: AudioContext;
  end: number;
  frame: number;
};

function scheduleClicks(context: AudioContext) {
  const start = context.currentTime + LEAD_IN_SECONDS;
  const interval = CALIBRATION_INTERVAL_MS / MS;
  const total = CALIBRATION_COUNT_IN + CALIBRATION_CLICKS;

  const clicks = Array.from({ length: total }, (_, index) =>
    scheduleClick({
      context,
      kind: index === CALIBRATION_COUNT_IN ? "accent" : "beat",
      time: start + index * interval,
    }),
  );

  const measuredStart = start + CALIBRATION_COUNT_IN * interval;

  return {
    clicks,
    clicksMs: Array.from({ length: CALIBRATION_CLICKS }, (_, index) =>
      heardAtMs(context, measuredStart + index * interval),
    ),
    end: start + total * interval,
    measuredStart,
  };
}

function stopRun(run: { current: Run | null }): Run | null {
  const current = run.current;
  run.current = null;

  if (current) {
    cancelAnimationFrame(current.frame);
    silenceClicks(current.clicks);
  }

  return current;
}

export function useDelayCalibration() {
  const [phase, setPhase] = useState<CalibrationPhase>({ kind: "idle" });
  const run = useRef<Run | null>(null);
  const starts = useRef(0);
  const taps = useRef<number[]>([]);

  // A sound check its screen leaves (hidden while the learner reads another) can't finish, so it
  // starts over.
  useEffect(
    () => () => {
      starts.current += 1;

      if (stopRun(run)) {
        taps.current = [];
        setPhase({ kind: "idle" });
      }
    },
    [],
  );

  function follow(measuredStart: number) {
    const current = run.current;

    if (!current) {
      return;
    }

    const now = current.context.currentTime;

    if (now > current.end) {
      run.current = null;

      setPhase({
        delayMs: estimateDeviceDelay({
          clicksMs: current.clicksMs,
          intervalMs: CALIBRATION_INTERVAL_MS,
          tapsMs: taps.current,
        }),
        kind: "done",
      });

      return;
    }

    const click = Math.floor(((now - measuredStart) * MS) / CALIBRATION_INTERVAL_MS) + 1;
    setPhase(now < measuredStart ? { kind: "countIn" } : { click, kind: "tapping" });
    current.frame = requestAnimationFrame(() => follow(measuredStart));
  }

  async function start() {
    stopRun(run);
    starts.current += 1;
    const started = starts.current;
    const context = await startActivityAudio();

    if (started !== starts.current) {
      return;
    }

    const { clicks, clicksMs, end, measuredStart } = scheduleClicks(context);

    taps.current = [];
    setPhase({ kind: "countIn" });

    run.current = {
      clicks,
      clicksMs,
      context,
      end,
      frame: requestAnimationFrame(() => follow(measuredStart)),
    };
  }

  function tap(eventTimeMs: number) {
    if (run.current) {
      taps.current = [...taps.current, eventTimeMs];
    }
  }

  return { phase, start, tap };
}
