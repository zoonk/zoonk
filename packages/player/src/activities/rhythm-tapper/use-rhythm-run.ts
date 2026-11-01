"use client";

import { rhythmHitSteps, rhythmStepMs } from "@zoonk/core/library/activities/music";
import { useEffect, useRef, useState } from "react";
import { scheduleClick, silenceClicks, startActivityAudio } from "../_utils/activity-audio";
import { heardAtMs } from "./rhythm-clock";

type RhythmFields = { pattern: string; rounds: number; stepsPerBeat: number; tempo: number };

type RunKind = "listen" | "tap";

type RunPhase = "countIn" | "done" | "idle" | "listening" | "tapping";

export type RunPosition = { round: number; step: number };

const LEAD_IN_SECONDS = 0.15;
const TAIL_SECONDS = 0.5;
const MS = 1000;

type Session = {
  clicks: OscillatorNode[];
  context: AudioContext;
  end: number;
  frame: number;
  kind: RunKind;
  heardStartMs: number;
  roundsStart: number;
  stepSeconds: number;
};

function playingPhase({ isCounting, kind }: { isCounting: boolean; kind: RunKind }): RunPhase {
  if (isCounting) {
    return "countIn";
  }

  return kind === "tap" ? "tapping" : "listening";
}

function samePosition(first: RunPosition | null, second: RunPosition | null): boolean {
  return first?.round === second?.round && first?.step === second?.step;
}

function scheduleRun({
  context,
  fields,
  kind,
  start,
}: {
  context: AudioContext;
  fields: RhythmFields;
  kind: RunKind;
  start: number;
}) {
  const stepSeconds = rhythmStepMs(fields) / MS;
  const beats = fields.pattern.length / fields.stepsPerBeat;
  const beatSeconds = stepSeconds * fields.stepsPerBeat;
  const countInBeats = kind === "tap" ? beats : 0;
  const rounds = kind === "tap" ? fields.rounds : 1;
  const roundsStart = start + countInBeats * beatSeconds;

  const beatClicks = Array.from({ length: countInBeats + rounds * beats }, (_, beat) =>
    scheduleClick({
      context,
      kind: beat % beats === 0 ? "accent" : "beat",
      time: start + beat * beatSeconds,
    }),
  );

  const hitClicks =
    kind === "listen"
      ? rhythmHitSteps(fields.pattern).map((step) =>
          scheduleClick({ context, kind: "hit", time: roundsStart + step * stepSeconds }),
        )
      : [];

  return {
    clicks: [...beatClicks, ...hitClicks],
    end: roundsStart + rounds * beats * beatSeconds,
    roundsStart,
    stepSeconds,
  };
}

function stopSession(session: { current: Session | null }): Session | null {
  const current = session.current;
  session.current = null;

  if (current) {
    cancelAnimationFrame(current.frame);
    silenceClicks(current.clicks);
  }

  return current;
}

export function useRhythmRun({
  fields,
  onFinish,
}: {
  fields: RhythmFields;
  onFinish: (tapsMs: number[]) => void;
}) {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [position, setPosition] = useState<RunPosition | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const session = useRef<Session | null>(null);
  const starts = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  // The screen kept hidden while the learner reads another stops its effects: a run it leaves
  // can't finish, so it starts over, and a finished one stays.
  useEffect(
    () => () => {
      starts.current += 1;

      if (stopSession(session)) {
        tapsRef.current = [];
        setTaps([]);
        setPosition(null);
        setPhase("idle");
      }
    },
    [],
  );

  function follow() {
    const current = session.current;

    if (!current) {
      return;
    }

    const now = current.context.currentTime;

    if (now > current.end + TAIL_SECONDS) {
      session.current = null;
      setPosition(null);
      setPhase(current.kind === "tap" ? "done" : "idle");

      if (current.kind === "tap") {
        finishRef.current(tapsRef.current);
      }

      return;
    }

    const elapsedSteps = Math.floor((now - current.roundsStart) / current.stepSeconds);
    const isCounting = now < current.roundsStart;

    const next =
      isCounting || now > current.end
        ? null
        : {
            round: Math.floor(elapsedSteps / fields.pattern.length),
            step: elapsedSteps % fields.pattern.length,
          };

    setPhase(playingPhase({ isCounting, kind: current.kind }));
    setPosition((previous) => (samePosition(previous, next) ? previous : next));

    current.frame = requestAnimationFrame(follow);
  }

  async function start(kind: RunKind) {
    stopSession(session);
    starts.current += 1;
    const started = starts.current;
    const context = await startActivityAudio();

    if (started !== starts.current) {
      return;
    }

    const startTime = context.currentTime + LEAD_IN_SECONDS;
    const run = scheduleRun({ context, fields, kind, start: startTime });

    tapsRef.current = [];
    setTaps([]);
    setPhase(kind === "tap" ? "countIn" : "listening");

    session.current = {
      ...run,
      context,
      frame: requestAnimationFrame(follow),
      heardStartMs: heardAtMs(context, run.roundsStart),
      kind,
    };
  }

  function tap(eventTimeMs: number) {
    const current = session.current;

    if (!current || current.kind !== "tap") {
      return;
    }

    const tapMs = eventTimeMs - current.heardStartMs;
    const lastMs = (current.end - current.roundsStart) * MS;
    const graceMs = (current.stepSeconds * fields.stepsPerBeat * MS) / 2;

    if (tapMs < -graceMs || tapMs > lastMs + graceMs) {
      return;
    }

    tapsRef.current = [...tapsRef.current, tapMs];
    setTaps(tapsRef.current);
  }

  function reset() {
    starts.current += 1;
    stopSession(session);
    tapsRef.current = [];
    setTaps([]);
    setPosition(null);
    setPhase("idle");
  }

  return { phase, position, reset, start, tap, taps };
}
