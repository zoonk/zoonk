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

/**
 * A row inside a phase of the path (a chapter, its challenge or its next mock), flat on the page:
 * its text starts where the phase's title starts, its highlight (the next chapter, the pointer)
 * reaches a little past it as a list row's does, and its dates and chevrons line up with the
 * phases'.
 */
export const PATH_ROW_CLASS =
  "-mx-2.5 flex min-h-11 w-[calc(100%+1.25rem)] items-center gap-3 rounded-[0.625rem] px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A path row's mark, dot or face, in one width so the rows' text starts in one place. */
export const PATH_ROW_LEADING_CLASS = "flex size-4 shrink-0 items-center justify-center";

/** A phase's event (its mock, its challenge): a row of its own, opening its page. */
const EVENT_ROW_CLASS = cn(PATH_ROW_CLASS, "hover:bg-muted/70");

/** An event's day at the row's end, in the mono face as every date on the path. */
const EVENT_DATE_CLASS =
  "text-muted-foreground shrink-0 font-mono text-xs whitespace-nowrap tabular-nums";

/**
 * A phase's event as a row: opening its page (`href`) with the chevron that says so, or the same
 * row without either while it has no page yet (a challenge the plan adds when the day is opened),
 * its date kept in the dates' column.
 */
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

/**
 * The phase's checkpoint, the Trickster's challenge, at the end of its phase: when it comes, as its
 * page says (see `PlanPhaseCheckpointView.when`): on its day, in the next session, or after the
 * challenge before it once its phase's lessons are done. One still to win that the learner's plan
 * leaves to Plus (a language goal's call on the free plan, or any past a free exam plan's first
 * week) is marked Plus, as its page says. One the plan only adds once the day is opened (no
 * `planItemId` yet) has no page to open: its row says when, without a link.
 */
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
        {isDone && t("Won")}
        {!isDone && when === "nextSession" && t("In your next session")}
        {!isDone && when === "queued" && t("After the challenge before it")}
        {onDate && checkpoint.date && formatPlanDate(checkpoint.date)}
      </span>
    </EventRow>
  );
}

/**
 * How many mock exams a phase ahead holds; after the exam (`forNextSitting`), what they're for:
 * the next sitting, on its first day when the notice lists it.
 */
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

/**
 * The phase's next mock exam and its day; an exam's opens "About the exam", where its mocks are.
 * The mock itself opens from Today on its day. Without Plus it's marked Plus (`locked`). After the
 * exam (`forNextSitting`), it says it's for the next sitting. A long mock the plan already saves
 * time for (`fundedMocks`, from the day its saving starts) says how long it really is under its
 * name and opens its own intro (`challengeHref`), which shows it before its day and moves it to
 * another day.
 */
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
        {/* Its real length on its own line, so the title and the date column keep their room. */}
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
