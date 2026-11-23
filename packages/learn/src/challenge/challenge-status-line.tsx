"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { daysBetween } from "../_utils/iso-date";
import { useChallengeScreen } from "./challenge-context";

export function StatusLine({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <p className="text-muted-foreground flex min-h-11 items-start gap-3 py-3 text-sm">
      <LineMarker aria-hidden="true">{icon}</LineMarker>
      <span>{children}</span>
    </p>
  );
}

function renderNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

export function OpensLine() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const icon = <CalendarClockIcon className="size-4" />;

  if (challenge.date) {
    const days = Math.max(1, daysBetween(challenge.today, challenge.date));

    return (
      <StatusLine icon={icon}>
        {t.rich("{count, plural, one {Opens tomorrow} other {Opens in <mono>#</mono> days}}", {
          count: days,
          mono: renderNumber,
        })}
      </StatusLine>
    );
  }

  return <LessonsFirstLine />;
}

function LessonsFirstLine() {
  const t = useExtracted();

  return (
    <StatusLine icon={<CalendarClockIcon className="size-4" />}>
      {t("Opens when you finish the lessons before it")}
    </StatusLine>
  );
}

export function WaitingLine() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const empty = challenge.questions === 0 && !challenge.call && !challenge.mock;

  if (empty && challenge.date !== null && challenge.date > challenge.today) {
    return <OpensLine />;
  }

  return (
    <StatusLine icon={<CalendarClockIcon className="size-4" />}>
      {empty ? t("This challenge isn't ready yet.") : t("Next time you study")}
    </StatusLine>
  );
}
