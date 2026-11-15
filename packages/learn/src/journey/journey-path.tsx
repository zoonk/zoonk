"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ListRowChevronSpace } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { CurrentPhaseMark } from "./current-phase-mark";
import { type JourneyPathLinks } from "./journey-links";
import {
  CheckpointRow,
  MockRow,
  PATH_ROW_CLASS,
  PATH_ROW_LEADING_CLASS,
  PathRowBody,
  usePhaseMocksLine,
} from "./journey-phase-events";
import { PhaseWhen } from "./phase-when";
import { useRoadmapFinish } from "./use-roadmap";

type NodeState = PlanPhaseView["state"] | "finish";

function PathMarker({ state }: { state: NodeState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(PATH_ROW_LEADING_CLASS, "relative z-10")}
      data-slot="path-row-mark"
    >
      {state === "done" && <DoneMark />}
      {state === "current" && <CurrentPhaseMark />}
      {(state === "upcoming" || state === "unfinished" || state === "leftOut") && (
        <span className="ring-foreground/30 bg-background size-2.5 rounded-full ring-[1.5px] ring-inset" />
      )}
      {state === "finish" && <FlagIcon className="size-4" />}
    </span>
  );
}

function PathLine({ walked }: { walked: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-slot="path-line"
      className={cn(
        "absolute top-9 -bottom-2 left-2 w-px -translate-x-1/2",
        walked ? "bg-success/60" : "bg-border",
      )}
    />
  );
}

const DATE_CLASS = "text-muted-foreground text-right text-xs";

function PhaseTitle({ note, phase }: { note?: string | null; phase: PlanPhaseView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const phaseName = usePhaseName();
  const lessonsLeft = phase.lessonsTotal - phase.lessonsDone;

  return (
    <PathRowBody value={<PhaseWhen className={DATE_CLASS} phase={phase} />}>
      <span
        className={cn("text-sm font-medium", phase.state === "done" && "text-muted-foreground")}
      >
        {phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}
        {phase.state === "current" && <span className="sr-only">{t(", you are here")}</span>}
        {phase.state === "done" && <span className="sr-only">{t(", done")}</span>}
      </span>
      {phase.state === "leftOut" && (
        <span className="text-muted-foreground text-xs">{t("Not in your plan")}</span>
      )}
      {phase.state === "unfinished" && lessonsLeft > 0 && (
        <span className="text-muted-foreground text-xs">
          {t("{count, plural, one {# lesson not studied} other {# lessons not studied}}", {
            count: lessonsLeft,
          })}
        </span>
      )}
      {note && <span className="text-muted-foreground text-xs">{note}</span>}
    </PathRowBody>
  );
}

function CompactPhaseNode({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const { plan } = usePlanScreen();
  const mocksLine = usePhaseMocksLine();
  const { checkpoint, mocks, state } = phase;
  const forNextSitting = phase.kind === "afterExam";
  const isCurrent = state === "current";
  const hasEvents = isCurrent && (checkpoint !== null || mocks.nextDate !== null);

  return (
    <li aria-current={isCurrent ? "step" : undefined} className="relative pb-3" data-state={state}>
      <PathLine walked={state === "done"} />

      <div className={PATH_ROW_CLASS} data-slot="path-row">
        <PathMarker state={state} />
        <PhaseTitle
          note={
            state === "upcoming" && mocks.count > 0
              ? mocksLine({
                  count: mocks.count,
                  forNextSitting,
                  nextSitting: plan.schedule.nextSitting,
                })
              : null
          }
          phase={phase}
        />
        <ListRowChevronSpace />
      </div>

      {hasEvents && (
        <ul className="nested-rows flex flex-col pb-1.5" data-slot="path-nested">
          {mocks.nextDate && (
            <li>
              <MockRow
                challengeHref={links.challenge}
                date={mocks.nextDate}
                examHref={links.exam}
              />
            </li>
          )}
          {checkpoint && (
            <li>
              <CheckpointRow checkpoint={checkpoint} links={links} />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function FinishNode({ continues, examHref }: { continues: boolean; examHref: string | null }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();

  const content = (
    <PathRowBody
      value={
        finish ? (
          <PlanDateText
            className={DATE_CLASS}
            estimate={finish.estimate}
            isoDate={finish.isoDate}
            month={finish.month}
          />
        ) : (
          goal.kind === "exam" && <span className={DATE_CLASS}>{t("Date to be confirmed")}</span>
        )
      }
    >
      <span className="text-sm font-medium">{goal.displayName}</span>
      {examHref && <span className="text-muted-foreground text-xs">{t("About the exam")}</span>}
    </PathRowBody>
  );

  return (
    <li className={cn("relative", continues && "pb-3")} data-state="finish">
      {continues && <PathLine walked={false} />}
      {examHref ? (
        <LearnLink
          className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
          data-slot="path-row"
          href={examHref}
        >
          <PathMarker state="finish" />
          {content}
          <RowChevron />
        </LearnLink>
      ) : (
        <div className={PATH_ROW_CLASS} data-slot="path-row">
          <PathMarker state="finish" />
          {content}
          <ListRowChevronSpace />
        </div>
      )}
    </li>
  );
}

export function JourneyPath({ links }: { links: JourneyPathLinks }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const afterExam = plan.phases.filter((phase) => phase.kind === "afterExam");

  const toNode = (phase: PlanPhaseView) => (
    <CompactPhaseNode key={phase.index} links={links} phase={phase} />
  );

  return (
    <ol
      aria-label={t("Your path")}
      className="flex flex-col [&>li:last-child>[data-slot=path-line]]:hidden"
      data-slot="journey-path-list"
    >
      {plan.phases.filter((phase) => phase.kind !== "afterExam").map((phase) => toNode(phase))}
      <FinishNode continues={afterExam.length > 0} examHref={links.exam} />
      {afterExam.map((phase) => toNode(phase))}
    </ol>
  );
}
