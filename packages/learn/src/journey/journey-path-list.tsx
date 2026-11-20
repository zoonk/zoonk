"use client";

import { type PlanChapterView, type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import { ListRowChevronSpace, ROW_FOLD_CLASS } from "../_components/list-group";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { JourneyChapters } from "./journey-chapters";
import { type JourneyPathLinks } from "./journey-links";
import {
  CheckpointRow,
  PATH_ROW_CLASS,
  PATH_ROW_LEADING_CLASS,
  PathRowBody,
} from "./journey-phase-events";
import { PHASE_END_CLASS, PhaseMark, PhaseName } from "./path-phase-row";
import { findOpenPhase, findOwnChapter, isNamedLikeAChapter } from "./path-phases";
import { PhaseWhen } from "./phase-when";
import { useRoadmapFinish } from "./use-roadmap";

function PhaseColumns({
  byPlace = false,
  nextChapter,
  open,
  phase,
}: {
  byPlace?: boolean;
  nextChapter?: PlanChapterView;
  open: boolean;
  phase: PlanPhaseView;
}) {
  return (
    <>
      <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
        {nextChapter ? <ChapterMark chapter={nextChapter} isNext /> : <PhaseMark phase={phase} />}
      </span>
      <PathRowBody value={<PhaseWhen className={PHASE_END_CLASS} phase={phase} />}>
        <PhaseName byPlace={byPlace} isNext={Boolean(nextChapter)} open={open} phase={phase} />
      </PathRowBody>
    </>
  );
}

const NESTED_CLASS = "nested-rows flex flex-col pb-2";

function OpenPhaseEvents({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  return (
    phase.checkpoint && (
      <div className={NESTED_CLASS} data-slot="path-nested">
        <CheckpointRow checkpoint={phase.checkpoint} links={links} />
      </div>
    )
  );
}

function ChapterPhase({
  chapter,
  links,
  open,
  phase,
}: {
  chapter: PlanChapterView & { chapterId: string };
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const isNext = chapter.state === "current";

  return (
    <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
      <LearnLink
        className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
        data-highlighted={isNext || undefined}
        data-slot="path-row"
        href={links.chapter(chapter.chapterId)}
      >
        <PhaseColumns nextChapter={isNext ? chapter : undefined} open={open} phase={phase} />
        <RowChevron />
      </LearnLink>

      {open && <OpenPhaseEvents links={links} phase={phase} />}
    </li>
  );
}

function ChaptersPhase({
  byPlace,
  links,
  open,
  phase,
}: {
  byPlace: boolean;
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const hasContent = phase.chapters.length > 0 || phase.checkpoint !== null;

  const header = <PhaseColumns byPlace={byPlace} open={open} phase={phase} />;

  if (!hasContent) {
    return (
      <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
        <div className={PATH_ROW_CLASS} data-slot="path-row">
          {header}
          <ListRowChevronSpace />
        </div>
      </li>
    );
  }

  return (
    <li aria-current={phase.state === "current" ? "step" : undefined} data-state={phase.state}>
      {/* The key remounts the phase when the plan goes on elsewhere, so one opened or shut by
          hand keeps it until then. */}
      <Collapsible defaultOpen={open} key={open ? "open" : "shut"}>
        <CollapsibleTrigger
          className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
          data-slot="path-row"
        >
          {header}
          <FoldChevron />
        </CollapsibleTrigger>

        <CollapsibleContent className={ROW_FOLD_CLASS}>
          <div className={NESTED_CLASS} data-slot="path-nested">
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
  links,
  open,
  phase,
}: {
  links: JourneyPathLinks;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const phaseName = usePhaseName();
  const name = phaseName(phase);
  const own = findOwnChapter({ name, phase });

  if (own) {
    return <ChapterPhase chapter={own} links={links} open={open} phase={phase} />;
  }

  return (
    <ChaptersPhase
      byPlace={isNamedLikeAChapter({ name, phase })}

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
      <div className={PATH_ROW_CLASS} data-slot="path-row">
        <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
          <FlagIcon aria-hidden="true" className="size-4" />
        </span>
        <PathRowBody
          value={
            finish && (
              <PlanDateText
                className="text-muted-foreground text-xs"
                estimate={finish.estimate}
                isoDate={finish.isoDate}
                month={finish.month}
              />
            )
          }
        >
          <span className="font-medium">{goal.displayName}</span>
        </PathRowBody>
        <ListRowChevronSpace />
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

  const toItem = (phase: PlanPhaseView) => (
    <PhaseItem key={phase.index} links={links} open={phase.index === openIndex} phase={phase} />
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
