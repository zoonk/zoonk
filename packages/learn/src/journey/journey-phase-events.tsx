"use client";

import { type PlanPhaseCheckpointView } from "@zoonk/core/plans/view-contract";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { PlusMark } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { type JourneyPathLinks } from "./journey-links";

export const PATH_ROW_CLASS =
  "-mx-2.5 flex min-h-11 w-[calc(100%+1.25rem)] items-center gap-3 rounded-[0.625rem] px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export const PATH_ROW_LEADING_CLASS = "flex size-4 shrink-0 items-center justify-center";

const EVENT_ROW_CLASS = cn(PATH_ROW_CLASS, "hover:bg-muted/70");

const EVENT_DATE_CLASS =
  "text-muted-foreground shrink-0 font-mono text-xs whitespace-nowrap tabular-nums";

function EventRow({ children, href }: { children: React.ReactNode; href: string | null }) {
  if (!href) {
    return (
      <div className={PATH_ROW_CLASS}>
        {children}
        <span aria-hidden="true" className="size-4 shrink-0" />
      </div>
    );
  }

  return (
    <LearnLink className={EVENT_ROW_CLASS} href={href}>
      {children}
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
    </LearnLink>
  );
}

export function CheckpointRow({
  checkpoint,
  links,
}: {
  checkpoint: PlanPhaseCheckpointView;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const isDone = checkpoint.state === "done";
  // A locked one is never in a session, so it keeps its planned day.
  const when = checkpoint.locked ? "date" : checkpoint.when;
  const onDate = !isDone && when === "date";

  return (
    <EventRow href={checkpoint.planItemId ? links.challenge(checkpoint.planItemId) : null}>
      <span className={PATH_ROW_LEADING_CLASS}>
        <Trickster className="-m-1 size-5" />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 font-medium",
          isDone && "text-muted-foreground",
        )}
      >
        {t("Phase challenge")}
        {checkpoint.locked && <PlusMark />}
      </span>
      <span className={cn(EVENT_DATE_CLASS, !onDate && "font-sans")}>
        {isDone && t({ description: "The learner won this phase challenge.", message: "Won" })}
        {!isDone && when === "nextSession" && t("In your next session")}
        {!isDone && when === "queued" && t("After the challenge before it")}
        {onDate && checkpoint.date && formatPlanDate(checkpoint.date)}
      </span>
    </EventRow>
  );
}

export function usePhaseMocksLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({
    count,
    forNextSitting,
    nextSitting,
  }: {
    count: number;
    forNextSitting: boolean;
    nextSitting: string | null;
  }): string => {
    if (!forNextSitting) {
      return t("{count, plural, one {# mock exam} other {# mock exams}}", { count });
    }

    return nextSitting
      ? t(
          "{count, plural, one {# mock exam} other {# mock exams}} for the next sitting, on {date}",
          { count, date: formatDate(nextSitting, "day") },
        )
      : t("{count, plural, one {# mock exam} other {# mock exams}} for the next sitting", {
          count,
        });
  };
}

export function MockRow({
  challengeHref,
  date,
  examHref,
  forNextSitting = false,
  locked = false,
}: {
  challengeHref: (planItemId: string) => string;
  date: string;
  examHref: string | null;
  forNextSitting?: boolean;
  locked?: boolean;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const funded = plan.fundedMocks.find((mock) => mock.scheduledFor === date);
  const href = funded ? challengeHref(funded.id) : examHref;

  return (
    <EventRow href={href}>
      <span className={PATH_ROW_LEADING_CLASS}>
        <KindMark kind="mock" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2 font-medium text-pretty">
          {forNextSitting ? t("Mock exam for the next sitting") : t("Mock exam")}
          {locked && <PlusMark />}
        </span>
        {funded?.minutes ? (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatDuration(funded.minutes)}
          </span>
        ) : null}
      </span>
      <span className={EVENT_DATE_CLASS}>{formatPlanDate(date)}</span>
    </EventRow>
  );
}
