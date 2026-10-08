"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlusMark } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { JourneyChapters } from "./journey-chapters";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, MockRow } from "./journey-phase-events";
import { usePhaseWhen } from "./use-phase-when";

type NodeState = PlanPhaseView["state"] | "finish";

/**
 * A node on the path: a check once done, a filled dot where the learner is, the goal's flag. It
 * sits in a box as tall as its title's first line (`HEADER_CLASS`), so its centre is on that line.
 */
function PathMarker({ state }: { state: NodeState }) {
  return (
    <span aria-hidden="true" className="relative z-10 flex h-11 shrink-0 items-center">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          state === "done" && "bg-success text-background",
          state === "current" && "bg-primary ring-primary/15 ring-4",
          state === "upcoming" && "border-border bg-card border-2",
          state === "finish" && "bg-foreground text-background",
        )}
      >
        {state === "done" && <CheckIcon className="size-4" strokeWidth={3} />}
        {state === "current" && <span className="bg-primary-foreground size-2.5 rounded-full" />}
        {state === "finish" && <FlagIcon className="size-4" />}
      </span>
    </span>
  );
}

/**
 * The stretch of path from a node down to the next one, centred under the nodes and tucked under
 * both (they sit 6px into their 44px box): walked once the phase is done.
 */
function PathLine({ walked }: { walked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-9 -bottom-2 left-3.75 w-0.5 rounded-full",
        walked ? "bg-success/60" : "bg-border",
      )}
    />
  );
}

/** A node's date: a long one ("Por volta de maio de 2027") wraps before it squeezes the title. */
const DATE_CLASS = "text-muted-foreground max-w-[45%] shrink-0 text-right text-sm text-balance";

function PhaseTitle({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const phaseName = usePhaseName();
  const phaseWhen = usePhaseWhen();
  const when = phaseWhen(phase);

  return (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 text-base",
          phase.state === "done" && "text-muted-foreground",
          phase.state === "current" && "font-semibold",
          phase.state === "upcoming" && "font-medium",
        )}
      >
        {phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}
        {phase.state === "current" && <span className="sr-only">{t(", you are here")}</span>}
        {phase.state === "done" && <span className="sr-only">{t(", done")}</span>}
      </span>
      {when && <span className={DATE_CLASS}>{when}</span>}
    </>
  );
}

/**
 * A node's line: the title's first line is 44px tall (its node's box), and the date beside it shares
 * its baseline, however many lines the title takes. Its end keeps the phase events' inset, so every
 * date and chevron on the path lines up in one column.
 */
const HEADER_CLASS = "flex min-h-11 w-full items-baseline gap-3 py-2.5 pr-3 text-left";

/** A header that opens something: its hover reaches past the text, which stays where it was. */
const HEADER_INTERACTIVE_CLASS =
  "focus-visible:ring-ring/50 hover:bg-muted/60 -mx-2 w-[calc(100%+1rem)] rounded-xl pr-5 pl-2 outline-none focus-visible:ring-[3px]";

/** Where a header without a chevron would have it, so its date stays in the dates' column. */
function ChevronSpace() {
  return <span aria-hidden="true" className="size-4 shrink-0" />;
}

/** A header's chevron, centred on the title's first line. */
const HEADER_CHEVRON_CLASS = "text-muted-foreground mt-1 size-4 shrink-0 self-start";

/**
 * A phase of a goal whose structure has its own section below: one line, and in the phase the
 * learner is in, its next mock and the challenge that closes it. Phases ahead say how many mocks
 * they hold. Without mocks in the learner's plan (they come with Plus), they show all the same,
 * marked Plus.
 */
function CompactPhaseNode({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { checkpoint, mocks, state } = phase;
  const locked = plan.access.mocksRequirePlus;
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
          <p className="text-muted-foreground -mt-1.5 flex items-center gap-2 pb-1 text-sm">
            {t("{count, plural, one {# mock exam} other {# mock exams}}", { count: mocks.count })}
            {locked && <PlusMark />}
          </p>
        )}

        {hasEvents && (
          <ul className="flex flex-col gap-2 pt-1 pb-1">
            {mocks.nextDate && (
              <li>
                <MockRow date={mocks.nextDate} examHref={links.exam} locked={locked} />
              </li>
            )}
            {checkpoint && (
              <li>
                <CheckpointRow checkpoint={checkpoint} links={links} />
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * A phase on the path. With links (the Journey), it opens in place to its chapters and its
 * checkpoint; the current phase starts open. Without them (the plan reveal), it's one line.
 */
function PhaseNode({
  compact,
  links,
  phase,
}: {
  compact: boolean;
  links: JourneyPathLinks | null;
  phase: PlanPhaseView;
}) {
  if (compact && links) {
    return <CompactPhaseNode links={links} phase={phase} />;
  }

  const hasContent = phase.chapters.length > 0 || phase.checkpoint !== null;

  if (!links || !hasContent) {
    return (
      <li
        aria-current={phase.state === "current" ? "step" : undefined}
        className="relative flex gap-3 pb-3"
        data-state={phase.state}
      >
        <PathLine walked={phase.state === "done"} />
        <PathMarker state={phase.state} />
        <div className={HEADER_CLASS}>
          <PhaseTitle phase={phase} />
          {links && <ChevronSpace />}
        </div>
      </li>
    );
  }

  return (
    <li
      aria-current={phase.state === "current" ? "step" : undefined}
      className="relative flex gap-3 pb-3"
      data-state={phase.state}
    >
      <PathLine walked={phase.state === "done"} />
      <PathMarker state={phase.state} />

      <Collapsible className="min-w-0 flex-1" defaultOpen={phase.state === "current"}>
        <CollapsibleTrigger className={cn(HEADER_CLASS, HEADER_INTERACTIVE_CLASS, "group/phase")}>
          <PhaseTitle phase={phase} />
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              HEADER_CHEVRON_CLASS,
              "transition-transform group-data-panel-open/phase:rotate-180 motion-reduce:transition-none",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="pt-1 pb-1">
            <JourneyChapters
              chapters={phase.chapters}
              checkpoint={phase.checkpoint}
              links={links}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/** When the goal is: its date ("About" an estimated one), or when the plan ends at this pace. */
function useFinishDate(): string | null {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (targetDate) {
    return targetDateEstimated
      ? t("About {date}", { date: formatDate(targetDate, "day") })
      : formatDate(targetDate, "day");
  }

  const { endDate } = plan.estimate;

  return endDate ? t("About {date}", { date: formatDate(endDate, "month") }) : null;
}

/**
 * The end of the path: the goal itself. An exam's opens "About the exam"; on a path whose rows open
 * (`linked`), another keeps its date in the dates' column.
 */
function FinishNode({ examHref, linked }: { examHref: string | null; linked: boolean }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const date = useFinishDate();

  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold">{goal.title}</span>
        {examHref && <span className="text-muted-foreground text-xs">{t("About the exam")}</span>}
      </span>
      {date && <span className={DATE_CLASS}>{date}</span>}
    </>
  );

  return (
    <li className="relative flex gap-3" data-state="finish">
      <PathMarker state="finish" />
      {examHref ? (
        <LearnLink className={cn(HEADER_CLASS, HEADER_INTERACTIVE_CLASS)} href={examHref}>
          {content}
          <ChevronRightIcon aria-hidden="true" className={HEADER_CHEVRON_CLASS} />
        </LearnLink>
      ) : (
        <div className={HEADER_CLASS}>
          {content}
          {linked && <ChevronSpace />}
        </div>
      )}
    </li>
  );
}

/**
 * The way to the goal as one vertical path: each phase a node (done, where the learner is, ahead),
 * the current one open to its chapters, and the goal as the finish. With `links` every phase opens
 * in place and every row opens its page; without them (the plan reveal) the path shows only phases.
 * `compact` keeps it a timeline (phases, the current one's next mock and challenge, the finish)
 * when the goal's subjects or modules show its chapters instead.
 */
export function JourneyPath({
  className,
  compact = false,
  links = null,
}: {
  className?: string;
  compact?: boolean;
  links?: JourneyPathLinks | null;
}) {
  const t = useExtracted();
  const { plan } = usePlanScreen();

  return (
    <ol aria-label={t("Your journey")} className={cn("flex flex-col", className)}>
      {plan.phases.map((phase) => (
        <PhaseNode compact={compact} key={phase.index} links={links} phase={phase} />
      ))}
      <FinishNode examHref={links?.exam ?? null} linked={links !== null} />
    </ol>
  );
}
