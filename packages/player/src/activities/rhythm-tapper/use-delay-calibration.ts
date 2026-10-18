"use client";

import { estimateDeviceDelay } from "@zoonk/core/library/activities/music";
import { useEffect, useRef, useState } from "react";
import { scheduleClick, startActivityAudio } from "../_utils/activity-audio";
import {
  CALIBRATION_CLICKS,
  CALIBRATION_COUNT_IN,
  CALIBRATION_INTERVAL_MS,
} from "./rhythm-calibration";
import { heardAtMs } from "./rhythm-clock";

const LEAD_IN_SECONDS = 0.15;
const MS = 1000;

/** Waiting to start, counting in, tapping along with click `click`, then the reading. */
export type CalibrationPhase =
  | { click: number; kind: "tapping" }
  | { delayMs: number | null; kind: "done" }
  | { kind: "countIn" }
  | { kind: "idle" };

type Run = { clicksMs: number[]; context: AudioContext; end: number; frame: number };

function scheduleClicks(context: AudioContext) {
  const start = context.currentTime + LEAD_IN_SECONDS;
  const interval = CALIBRATION_INTERVAL_MS / MS;
  const total = CALIBRATION_COUNT_IN + CALIBRATION_CLICKS;

  Array.from({ length: total }, (_, index) => index).forEach((index) => {
    scheduleClick({
      context,
      kind: index === CALIBRATION_COUNT_IN ? "accent" : "beat",
      time: start + index * interval,
    });
  });

  const measuredStart = start + CALIBRATION_COUNT_IN * interval;

  return {
    clicksMs: Array.from({ length: CALIBRATION_CLICKS }, (_, index) =>
      heardAtMs(context, measuredStart + index * interval),
    ),
    end: start + total * interval,
    measuredStart,
  };
}

/**
 * Measures how late this device plays sound: a few clicks to count in, then the learner taps
 * along with steady clicks, and the reading is the middle of their taps' distances from the
 * clicks as heard. Taps are timed by the page like the rhythm's, so the reading fits them.
 */
export function useDelayCalibration() {
  const [phase, setPhase] = useState<CalibrationPhase>({ kind: "idle" });
  const run = useRef<Run | null>(null);
  const taps = useRef<number[]>([]);

  useEffect(
    () => () => {
      cancelAnimationFrame(run.current?.frame ?? 0);
      run.current = null;
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
    cancelAnimationFrame(run.current?.frame ?? 0);
    const context = await startActivityAudio();
    const { clicksMs, end, measuredStart } = scheduleClicks(context);

    taps.current = [];
    setPhase({ kind: "countIn" });

    run.current = {
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
