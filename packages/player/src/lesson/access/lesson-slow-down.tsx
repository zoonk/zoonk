"use client";

import { TaskActionBar, TaskActions, TaskStopMessage } from "@zoonk/learn/task-layout";
import { HourglassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { PlayerContentFrame } from "../../components/step-layouts";

const MS_PER_SECOND = 1000;

/** A lesson that can't open: what stopped, one line, and its one way on in the bar where "Check" is. */
export function AccessLayout({
  actions,
  description,
  icon,
  title,
}: {
  actions?: React.ReactNode;
  description?: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <>
      <PlayerContentFrame
        className="flex flex-1 flex-col gap-6 pt-4 pb-8"
        data-slot="lesson-access"
      >
        <TaskStopMessage description={description} icon={icon} title={title} />
      </PlayerContentFrame>

      {actions && (
        <TaskActionBar data-slot="lesson-access-bar">
          <TaskActions>{actions}</TaskActions>
        </TaskActionBar>
      )}
    </>
  );
}

export function LessonSlowDown({
  onRetry,
  retryAfterSeconds,
}: {
  onRetry: () => void;
  retryAfterSeconds: number;
}) {
  const t = useExtracted();
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onRetry();
      return;
    }

    const timeout = globalThis.setTimeout(() => setSecondsLeft(secondsLeft - 1), MS_PER_SECOND);
    return () => globalThis.clearTimeout(timeout);
  }, [onRetry, secondsLeft]);

  return (
    <AccessLayout
      description={t(
        "You opened a lot of lessons quickly. This one opens on its own in {seconds, plural, =0 {# seconds} one {# second} other {# seconds}}.",
        { seconds: Math.max(secondsLeft, 0) },
      )}
      icon={<HourglassIcon aria-hidden="true" />}
      title={t("Take a short break")}
    />
  );
}
