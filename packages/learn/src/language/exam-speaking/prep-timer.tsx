"use client";

import { type SpeakingTaskView } from "@zoonk/core/language/exam-speaking/contract";
import { Button } from "@zoonk/ui/components/button";
import { HourglassIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Callout } from "../../_components/callout";
import { formatClock } from "../../_utils/clock";

const MS_PER_MINUTE = 60_000;
const TICK_MS = 500;

/** A preparation started this long ago belongs to another sitting, so the card starts over. */
const STALE_MINUTES = 360;

function getStorageKey(cardId: string): string {
  return `zoonk:exam-prep:${cardId}`;
}

/** When this card's preparation started on this device, if it did and isn't stale. */
function readStartedAt(cardId: string): number | null {
  try {
    const value = Number(globalThis.localStorage.getItem(getStorageKey(cardId)));
    return value > 0 && Date.now() - value < STALE_MINUTES * MS_PER_MINUTE ? value : null;
  } catch {
    return null;
  }
}

function writeStartedAt({ cardId, startedAt }: { cardId: string; startedAt: number }) {
  try {
    globalThis.localStorage.setItem(getStorageKey(cardId), String(startedAt));
  } catch {
    // Without storage the clock still runs; a reload just shows it ready to start again.
  }
}

/** Another tab of the same card starting its clock starts this one too. */
function subscribeToStorage(onChange: () => void) {
  globalThis.addEventListener("storage", onChange);
  return () => globalThis.removeEventListener("storage", onChange);
}

/** "The exam gives 10 min…", or the shared time and this task's share of it. */
function usePrepLine() {
  const t = useExtracted();
  const format = useFormatter();

  return (task: Pick<SpeakingTaskView, "prepMinutes" | "prepShared">) =>
    task.prepShared
      ? t(
          "The exam gives {total} min to prepare tasks {tasks} together, about {minutes} for this one.",
          {
            minutes: String(Math.round(task.prepMinutes)),
            tasks: format.list(task.prepShared.tasks.map(String), { type: "conjunction" }),
            total: String(Math.round(task.prepShared.minutes)),
          },
        )
      : t("The exam gives {minutes} min to prepare with the card.", {
          minutes: String(Math.round(task.prepMinutes)),
        });
}

/**
 * The exam's preparation time before a task, as the exam room's clock: the learner starts it when
 * they turn to the card, can start it again, and can start the call any time. The clock keeps
 * running through a reload or a locked phone (its start is kept on the device, per card), and
 * nothing is charged while it runs, since the call hasn't connected.
 */
export function PrepTimer({
  cardId,
  task,
}: {
  /** The task's call, whose card this preparation is for. */
  cardId: string;
  task: Pick<SpeakingTaskView, "prepMinutes" | "prepShared">;
}) {
  const t = useExtracted();
  const prepLine = usePrepLine();
  const clock = useRef<HTMLDivElement>(null);
  // The device's copy, read after hydration so the server's render and the first one match.
  const saved = useSyncExternalStore(
    subscribeToStorage,
    () => readStartedAt(cardId),
    () => null,
  );

  const [restartedAt, setRestartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = restartedAt ?? saved;
  const totalMs = task.prepMinutes * MS_PER_MINUTE;
  const leftMs = startedAt === null ? totalMs : Math.max(0, totalMs - (now - startedAt));

  useEffect(() => {
    if (startedAt === null || leftMs === 0) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [leftMs, startedAt]);

  const start = () => {
    const at = Date.now();
    writeStartedAt({ cardId, startedAt: at });
    setRestartedAt(at);
    setNow(at);
    // The button that started it gives way to the clock, so focus moves there with it.
    requestAnimationFrame(() => clock.current?.focus());
  };

  if (startedAt === null) {
    return (
      <Callout>
        <HourglassIcon aria-hidden="true" />
        <div className="flex flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>{prepLine(task)}</p>
          <Button className="shrink-0" onClick={start} size="sm" variant="outline">
            {t("Start preparing")}
          </Button>
        </div>
      </Callout>
    );
  }

  return (
    <Callout className="items-center outline-none" ref={clock} role="timer" tabIndex={-1}>
      <HourglassIcon aria-hidden="true" />
      <p className="flex-1">
        {leftMs === 0
          ? t("Preparation time is over. Start the call when you're ready.")
          : t("Preparing: {left} left", { left: formatClock(leftMs) })}
      </p>
      <Button className="shrink-0" onClick={start} size="sm" variant="ghost">
        {t("Start again")}
      </Button>
    </Callout>
  );
}
