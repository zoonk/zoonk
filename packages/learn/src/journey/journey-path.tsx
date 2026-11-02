"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlusMark } from "../_components/plus-lock";
import { DoneMark } from "../_components/status-mark";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { CurrentPhaseMark } from "./current-phase-mark";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, MockRow, usePhaseMocksLine } from "./journey-phase-events";
import { useFinishDate, usePhaseWhen } from "./use-phase-when";

type NodeState = PlanPhaseView["state"] | "finish";

function PathMarker({ state }: { state: NodeState }) {
  return (
    <span
      aria-hidden="true"
      className="relative z-10 flex h-11 w-4 shrink-0 items-center justify-center"
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
        "absolute top-8 -bottom-3 left-[7.5px] w-px",
        walked ? "bg-success/60" : "bg-border",
      )}
    />
  );
}

const DATE_CLASS =
  "text-muted-foreground shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums";

function PhaseTitle({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const phaseName = usePhaseName();
  const phaseWhen = usePhaseWhen();
  const when = phaseWhen(phase);

  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
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
        {phase.state === "unfinished" && (
          <span className="text-muted-foreground text-xs">
            {t(
              "{total, plural, one {{done, number} of # lesson done} other {{done, number} of # lessons done}}",
              { done: phase.lessonsDone, total: phase.lessonsTotal },
            )}
          </span>
        )}
      </span>
      {when && <span className={DATE_CLASS}>{when}</span>}
    </>
  );
}

const HEADER_CLASS = "flex min-h-11 w-full items-baseline gap-3 py-3 text-left";

const HEADER_INTERACTIVE_CLASS =
  "focus-visible:ring-ring/50 hover:bg-muted/70 -mx-2.5 w-[calc(100%+1.25rem)] rounded-[0.625rem] px-2.5 outline-none transition-colors focus-visible:ring-[3px]";

function ChevronSpace() {
  return <span aria-hidden="true" className="size-4 shrink-0" />;
}

const HEADER_CHEVRON_CLASS = "text-muted-foreground/60 size-4 shrink-0 self-center";

function CompactPhaseNode({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const { plan } = usePlanScreen();
  const mocksLine = usePhaseMocksLine();
  const { checkpoint, mocks, state } = phase;
  const locked = plan.access.mocksRequirePlus;
  const forNextSitting = phase.kind === "afterExam";
  const isCurrent = state === "current";
  const hasEvents = isCurrent && (checkpoint !== null || mocks.nextDate !== null);

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className="relative flex gap-3 pb-3"
      data-state={state}
    >
      <PathLine walked={state === "done"} />
      <PathMarker state={state} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className={HEADER_CLASS}>
          <PhaseTitle phase={phase} />
          <ChevronSpace />
        </div>

        {state === "upcoming" && mocks.count > 0 && (
          <p className="text-muted-foreground -mt-2.5 flex items-center gap-2 pb-1 text-xs">
            {mocksLine({
              count: mocks.count,
              forNextSitting,
              nextSitting: plan.schedule.nextSitting,
            })}
            {locked && <PlusMark />}
          </p>
        )}

        {hasEvents && (
          <ul className="flex flex-col pb-1">
            {mocks.nextDate && (
              <li>
                <MockRow
                  challengeHref={links.challenge}
                  date={mocks.nextDate}
                  examHref={links.exam}
                  forNextSitting={forNextSitting}
                  locked={locked}
                />
              </li>
            )}
            {checkpoint && (
              <li>
                <CheckpointRow brief checkpoint={checkpoint} links={links} />
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

const FINISH_HEADER_CLASS = "flex-wrap gap-y-0.5";

function FinishNode({ continues, examHref }: { continues: boolean; examHref: string | null }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const date = useFinishDate();

  const content = (
    <>
      <span className="min-w-0 flex-1 text-sm font-medium">{goal.title}</span>
      {examHref && (
        <span className="text-muted-foreground shrink-0 text-xs">{t("About the exam")}</span>
      )}
      {date && (
        <span className="text-muted-foreground order-last basis-full font-mono text-xs tabular-nums">
          {date}
        </span>
      )}
    </>
  );

  return (
    <li className={cn("relative flex gap-3", continues && "pb-3")} data-state="finish">
      {continues && <PathLine walked={false} />}
      <PathMarker state="finish" />
      {examHref ? (
        <LearnLink
          className={cn(HEADER_CLASS, HEADER_INTERACTIVE_CLASS, FINISH_HEADER_CLASS)}
          href={examHref}
        >
          {content}
          <ChevronRightIcon aria-hidden="true" className={HEADER_CHEVRON_CLASS} />
        </LearnLink>
      ) : (
        <div className={cn(HEADER_CLASS, FINISH_HEADER_CLASS)}>
          {content}
          <ChevronSpace />
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
    >
      {plan.phases.filter((phase) => phase.kind !== "afterExam").map((phase) => toNode(phase))}
      <FinishNode continues={afterExam.length > 0} examHref={links.exam} />
      {afterExam.map((phase) => toNode(phase))}
    </ol>
  );
}
