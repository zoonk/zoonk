"use client";

import { type SpeakingTaskView } from "@zoonk/core/language/exam-speaking/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useRef, useState, useSyncExternalStore } from "react";
import { formatClock } from "../../_utils/clock";
import { deviceStorage, subscribeToDeviceStorage } from "../../_utils/device-storage";
import { useFormatDuration } from "../../_utils/time-format";
import { useTimeLeft } from "../../_utils/use-time-left";

const MS_PER_MINUTE = 60_000;
const TICK_MS = 500;

const STALE_MINUTES = 360;

function getStorageKey(cardId: string): string {
  return `zoonk:exam-prep:${cardId}`;
}

function readStartedAt(cardId: string): number | null {
  const value = Number(deviceStorage.get(getStorageKey(cardId)));
  return value > 0 && Date.now() - value < STALE_MINUTES * MS_PER_MINUTE ? value : null;
}

function PrepTimeLeft({ deadline }: { deadline: number }) {
  const t = useExtracted();
  const leftMs = useTimeLeft({ deadline, tickMs: TICK_MS });

  if (leftMs === 0) {
    return (
      <p className="text-compact leading-snug text-pretty">{t("Preparation time is over.")}</p>
    );
  }

  return <p className="text-readout text-2xl leading-tight">{formatClock(leftMs)}</p>;
}

export function PrepTimer({
  cardId,
  task,
}: {
  cardId: string;
  task: Pick<SpeakingTaskView, "prepMinutes">;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const clock = useRef<HTMLDivElement>(null);
  // The device's copy, read after hydration so the server's render and the first one match.
  const saved = useSyncExternalStore(
    subscribeToDeviceStorage,
    () => readStartedAt(cardId),
    () => null,
  );

  const [restartedAt, setRestartedAt] = useState<number | null>(null);
  const startedAt = restartedAt ?? saved;

  const start = () => {
    const at = Date.now();
    deviceStorage.set(getStorageKey(cardId), String(at));
    setRestartedAt(at);
    // The button that started it gives way to the clock, so focus moves there with it.
    requestAnimationFrame(() => clock.current?.focus());
  };

  if (startedAt === null) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm leading-5 font-medium">{t("Preparation")}</p>
          <p className="text-muted-foreground text-compact leading-snug text-pretty">
            {t("{time}, as in the exam", { time: formatDuration(task.prepMinutes) })}
          </p>
        </div>
        <Button className="shrink-0" onClick={start} size="sm" variant="outline">
          {t("Start preparing")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div
        className="flex min-w-0 flex-col gap-1 outline-none"
        ref={clock}
        role="timer"
        tabIndex={-1}
      >
        <p className="text-sm leading-5 font-medium">{t("Preparation")}</p>
        {/* A new clock for every start, so it begins from the full time. */}
        <PrepTimeLeft deadline={startedAt + task.prepMinutes * MS_PER_MINUTE} key={startedAt} />
      </div>
      <Button className="shrink-0" onClick={start} size="sm" variant="ghost">
        {t("Start again")}
      </Button>
    </div>
  );
}
