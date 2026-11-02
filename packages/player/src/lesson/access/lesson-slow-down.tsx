"use client";

import { HourglassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { PlayerContentFrame } from "../../components/step-layouts";

const MS_PER_SECOND = 1000;

export function AccessLayout({
  children,
  description,
  icon,
  title,
}: {
  children?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <PlayerContentFrame className="flex flex-col gap-6 pt-4 pb-8" data-slot="lesson-access">
      <span className="text-muted-foreground flex [&_svg]:size-6">{icon}</span>
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-title">{title}</h2>
        <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
      </div>
      {children && <div className="flex flex-col gap-2 sm:flex-row">{children}</div>}
    </PlayerContentFrame>
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
        "You started a lot of lessons in a short time. This one opens in {seconds, plural, =0 {# seconds} one {# second} other {# seconds}}.",
        { seconds: Math.max(secondsLeft, 0) },
      )}
      icon={<HourglassIcon aria-hidden="true" />}
      title={t("Take a short break")}
    />
  );
}
