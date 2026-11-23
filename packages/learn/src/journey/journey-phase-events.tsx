"use client";

import { type PlanPhaseCheckpointView } from "@zoonk/core/plans/view-contract";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { MicIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { ListRowChevronSpace } from "../_components/list-group";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { MockSchedule } from "../mock/mock-schedule";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { type JourneyPathLinks } from "./journey-links";

export const PATH_ROW_CLASS =
  "row-bleed data-highlighted:bg-muted data-highlighted:hover:bg-muted flex min-h-11 items-center gap-3 rounded-lg py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export const PATH_ROW_LEADING_CLASS = "flex size-4 shrink-0 items-center justify-center";

export function PathRowBody({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: React.ReactNode;
}) {
  return (
    <span
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5"
      data-slot="path-row-body"
    >
      <span
        className="flex min-w-0 flex-[1_1_9rem] flex-col wrap-break-word *:first:text-balance"
        data-slot="path-row-words"
      >
        {children}
      </span>
      {value && (
        <span className="grid max-w-full shrink-0 text-xs" data-slot="path-row-value">
          {value}
        </span>
      )}
    </span>
  );
}

const EVENT_ROW_CLASS = cn(PATH_ROW_CLASS, "hover:bg-muted/70");

const EVENT_DATE_CLASS = "text-muted-foreground text-xs";

function EventRow({ children, href }: { children: React.ReactNode; href: string | null }) {
  if (!href) {
    return (
      <div className={PATH_ROW_CLASS} data-slot="path-row">
        {children}
        <ListRowChevronSpace />
      </div>
    );
  }

  return (
    <LearnLink className={EVENT_ROW_CLASS} data-slot="path-row" href={href}>
      {children}
      <RowChevron />
    </LearnLink>
  );
}

export function PhaseCheckpointMark() {
  const { goal } = usePlanScreen();

  return goal.kind === "language" ? (
    <MicIcon aria-hidden="true" className="size-4" />
  ) : (
    <Trickster className="size-4" view="face" />
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
  const { goal, today } = usePlanScreen();
  const isDone = checkpoint.state === "done";
  // A locked one is never in a session, so it keeps its planned day.
  const when = checkpoint.locked ? "date" : checkpoint.when;
  const onDate = !isDone && when === "date";

  return (
    <EventRow href={checkpoint.planItemId ? links.challenge(checkpoint.planItemId) : null}>
      <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
        <PhaseCheckpointMark />
      </span>
      <PathRowBody
        value={
          <span className={EVENT_DATE_CLASS}>
            {isDone && t({ description: "The learner won this phase challenge.", message: "Won" })}
            {!isDone &&
              when === "nextSession" &&
              (checkpoint.date === today ? t("Today") : t("In your next session"))}
            {onDate && checkpoint.date && <PlanDateText estimate isoDate={checkpoint.date} />}
          </span>
        }
      >
        <span className={cn("font-medium", isDone && "text-muted-foreground")}>
          {goal.kind === "language" ? t("Call") : t("The Trickster")}
        </span>

        {!isDone && (
          <span className="text-muted-foreground text-xs">
            {goal.kind === "language"
              ? t("A live call where you get your point across")
              : t("Questions on this phase, with no hints")}
          </span>
        )}
      </PathRowBody>
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
          "{count, plural, one {# mock exam before your next exam date, {date}} other {# mock exams before your next exam date, {date}}}",
          { count, date: formatDate(nextSitting, "row") },
        )
      : t(
          "{count, plural, one {# mock exam before your next exam date} other {# mock exams before your next exam date}}",
          { count },
        );
  };
}

export function MockRow({
  challengeHref,
  date,
  examHref,
  planItemId,
}: {
  challengeHref: (planItemId: string) => string;
  date: string;
  examHref: string | null;
  planItemId: string | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const funded = plan.fundedMocks.find((mock) => mock.scheduledFor === date);
  const id = planItemId ?? funded?.id;
  const href = id ? challengeHref(id) : examHref;

  return (
    <div>
      <EventRow href={href}>
        <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
          <KindDot kind="mock" />
        </span>
        <PathRowBody value={<PlanDateText className={EVENT_DATE_CLASS} isoDate={date} />}>
          <span className="font-medium">{t("Mock exam")}</span>
          {funded?.minutes ? (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {formatDuration(funded.minutes)}
            </span>
          ) : null}
        </PathRowBody>
      </EventRow>
      {id && (!funded || funded.status === "todo") && <MockSchedule planItemId={id} />}
    </div>
  );
}
