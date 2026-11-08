"use client";

import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useState } from "react";
import { PageSectionTitle } from "../_components/page";
import { ProgressRing } from "../_components/progress-ring";
import { formatClock } from "../_utils/clock";
import { getGenerationKind } from "../generation/generation-kinds";
import { type GenerationFirstLesson, type GenerationRun } from "../generation/generation-run";

const SECOND_MS = 1000;

/** How long a lesson usually takes to write, from its phases' usual durations. */
const LESSON_MS =
  getGenerationKind("lesson").phases.reduce((sum, phase) => sum + phase.seconds, 0) * SECOND_MS;

const ALMOST_DONE = 95;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

/** When lesson 1 started and finished on this device's clock, as far as the run reported. */
function getLessonTimes(run: GenerationRun) {
  const offset = run.clockOffsetMs ?? 0;
  const started = run.stepTimes?.writeFirstLesson?.started;
  const ended = run.stepTimes?.firstLessonReady?.completed;

  return {
    endedAt: ended === undefined ? null : ended + offset,
    startedAt: started === undefined ? null : started + offset,
  };
}

function LessonMark({ ready, startedAt }: { ready: boolean; startedAt: number | null }) {
  const value = useAnimatedProgress({
    active: !ready,
    estimatedMs: LESSON_MS,
    progress: ready ? 100 : 0,
    since: startedAt ?? undefined,
    target: ALMOST_DONE,
  });

  return (
    <span aria-hidden="true" className="row-span-2 flex h-5 items-center justify-center">
      {ready ? (
        <CheckIcon className="text-success size-4" />
      ) : (
        <ProgressRing className="size-4" share={value / 100} />
      )}
    </span>
  );
}

function LessonTime({ ready, run }: { ready: boolean; run: GenerationRun }) {
  const { endedAt, startedAt } = getLessonTimes(run);
  const now = useNow(!ready && startedAt !== null);
  const end = ready ? endedAt : now;

  if (startedAt === null || end === null) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground col-start-3 row-start-1 font-mono text-xs leading-5 tabular-nums"
    >
      {formatClock(Math.max(0, end - startedAt))}
    </span>
  );
}

/** Lesson 1 in the progress view, below the plan's steps: it's written alongside the plan. */
export function FirstLessonRow({
  lesson,
  run,
}: {
  lesson: GenerationFirstLesson;
  run: GenerationRun;
}) {
  const t = useExtracted();
  const titleId = useId();
  const ready = lesson.status === "ready";

  return (
    <section
      aria-labelledby={titleId}
      className="border-border flex flex-col gap-3 border-t pt-5"
      data-slot="first-lesson-row"
    >
      <PageSectionTitle id={titleId}>{t("Your first lesson")}</PageSectionTitle>

      <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-x-3">
        <LessonMark ready={ready} startedAt={getLessonTimes(run).startedAt} />
        <span className="col-start-2 text-sm leading-5 font-medium">{lesson.title}</span>
        <LessonTime ready={ready} run={run} />
        <span className="text-muted-foreground col-start-2 text-xs">
          {ready ? t("Ready to start") : t("Writing about 5 short screens")}
        </span>
      </div>
    </section>
  );
}
