"use client";

import { type PlanChapterView, type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon, ChevronRightIcon, FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { JourneyChapters, WritingAheadLine } from "./journey-chapters";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, PATH_ROW_CLASS, PATH_ROW_LEADING_CLASS } from "./journey-phase-events";
import { PhaseLessons, PhaseMark, PhaseName, PhaseUntil } from "./path-phase-row";
import { findOpenPhase, findOwnChapter, isNamedLikeAChapter } from "./path-phases";
import { useRoadmapFinish } from "./use-roadmap";

const PHASE_ROW_CLASS = cn(PATH_ROW_CLASS, "min-h-12");

function PhaseColumns({
  byPlace = false,
  isLast,
  nextChapter,
  open,
  phase,
}: {
  byPlace?: boolean;
  isLast: boolean;
  nextChapter?: PlanChapterView;
  open: boolean;
  phase: PlanPhaseView;
}) {
  return (
    <>
      <span className={PATH_ROW_LEADING_CLASS}>
        {nextChapter ? <ChapterMark chapter={nextChapter} isNext /> : <PhaseMark phase={phase} />}
      </span>
      <PhaseName byPlace={byPlace} isNext={Boolean(nextChapter)} open={open} phase={phase} />
      <PhaseLessons phase={phase} />
      <PhaseUntil isLast={isLast} phase={phase} />
    </>
  );
}

const NESTED_CLASS = "flex flex-col pl-7";

function OpenPhaseEvents({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const { goal } = usePlanScreen();

  return (
    <div className={NESTED_CLASS}>
      {phase.checkpoint && <CheckpointRow checkpoint={phase.checkpoint} links={links} />}
      <WritingAheadLine chapters={phase.chapters} unit={goal.kind === "language"} />
    </div>
  );
}

function ChapterPhase({
  chapter,
  isLast,
  links,
  open,
  phase,
}: {
  chapter: PlanChapterView & { chapterId: string };
  isLast: boolean;
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const isNext = chapter.state === "current";

  return (
    <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
      <LearnLink
        className={cn(PHASE_ROW_CLASS, "hover:bg-muted/70", isNext && "bg-muted hover:bg-muted")}
        href={links.chapter(chapter.chapterId)}
      >
        <PhaseColumns
          isLast={isLast}
          nextChapter={isNext ? chapter : undefined}
          open={open}
          phase={phase}
        />
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
      </LearnLink>

      {open && <OpenPhaseEvents links={links} phase={phase} />}
    </li>
  );
}

function ChaptersPhase({
  byPlace,
  isLast,
  links,
  open,
  phase,
}: {
  byPlace: boolean;
  isLast: boolean;
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const hasContent = phase.chapters.length > 0 || phase.checkpoint !== null;

  const header = <PhaseColumns byPlace={byPlace} isLast={isLast} open={open} phase={phase} />;

  if (!hasContent) {
    return (
      <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
        <div className={PHASE_ROW_CLASS}>
          {header}
          <span aria-hidden="true" className="size-4 shrink-0" />
        </div>
      </li>
    );
  }

  return (
    <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
      {/* The key remounts the phase when the plan goes on elsewhere, so one opened or shut by hand keeps it until then. */}
      <Collapsible defaultOpen={open} key={open ? "open" : "shut"}>
        <CollapsibleTrigger className={cn(PHASE_ROW_CLASS, "hover:bg-muted/70 group/phase")}>
          {header}
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground/60 size-4 shrink-0 transition-transform group-data-panel-open/phase:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className={NESTED_CLASS}>
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

function PhaseItem({
  isLast,
  links,
  open,
  phase,
}: {
  isLast: boolean;
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const phaseName = usePhaseName();
  const name = phaseName(phase);
  const own = findOwnChapter({ name, phase });

  if (own) {
    return <ChapterPhase chapter={own} isLast={isLast} links={links} open={open} phase={phase} />;
  }

  return (
    <ChaptersPhase
      byPlace={isNamedLikeAChapter({ name, phase })}
      isLast={isLast}
      links={links}
      open={open}
      phase={phase}
    />
  );
}

function FinishItem() {
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();

  return (
    <li data-state="finish">
      <div className={PHASE_ROW_CLASS}>
        <span className={PATH_ROW_LEADING_CLASS}>
          <FlagIcon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1 font-medium">{goal.title}</span>
        {finish && (
          <PlanDateText
            className="text-muted-foreground shrink-0 text-xs"
            estimate={finish.estimate}
            isoDate={finish.isoDate}
            month={finish.month}
          />
        )}
        <span aria-hidden="true" className="size-4 shrink-0" />
      </div>
    </li>
  );
}

export function JourneyPathList({ links }: { links: JourneyPathLinks }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const openIndex = findOpenPhase(plan.phases);
  const beforeFinish = plan.phases.filter((phase) => phase.kind !== "afterExam");
  const afterExam = plan.phases.filter((phase) => phase.kind === "afterExam");
  const lastIndex = beforeFinish.at(-1)?.index;

  const toItem = (phase: PlanPhaseView) => (
    <PhaseItem
      isLast={phase.index === lastIndex}
      key={phase.index}
      links={links}
      open={phase.index === openIndex}
      phase={phase}
    />
  );

  return (
    <ol
      aria-label={t("Your path")}
      className="flex flex-col [&>li+li]:border-t"
      data-slot="journey-path-list"
    >
      {beforeFinish.map((phase) => toItem(phase))}
      <FinishItem />
      {afterExam.map((phase) => toItem(phase))}
    </ol>
  );
}
