"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { useExtracted } from "next-intl";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { useFormatDuration } from "../_utils/time-format";
import { type DayStepPart } from "../session/day-meter-parts";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { DaySegment, type DaySegmentState } from "./day-segments";
import { useTodayScreen } from "./today-context";

export const DAY_SEGMENT_SLOT = "today-day-segment";

/**
 * Its hit area reaches past the thin bar so a finger can land on it: up to the heading and down to
 * the first row, 38px in all, since any taller it would cover one of them.
 */
const TRIGGER_CLASS =
  "relative flex min-w-1 grow basis-0 cursor-pointer rounded-meter outline-none transition-[filter] before:absolute before:-inset-x-px before:-top-5 before:-bottom-3 before:content-[''] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:brightness-125";

function useKindNote() {
  const t = useExtracted();

  const notes: Partial<Record<LearnKind, string>> = {
    challenge: t("Checks what you've learned so far."),
    essay: t("You put what you learned into your own words."),
    mistakes: t("Another try at questions you missed."),
    mock: t("A practice exam, like the real one."),
    practice: t("New questions that mix what you've learned."),
    review: t("Brings back what you studied before you forget it."),
  };

  return (kind: LearnKind): string | undefined => notes[kind];
}

function useSegmentFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return ({ block, state }: { block: DayStep; state: DaySegmentState }): string => {
    const time = formatDuration(block.estimatedMinutes);

    if (state === "done") {
      return t("Done");
    }

    if (state === "ahead") {
      return time;
    }

    return block.status === "active" && block.answered > 0
      ? t("{answered, number} of {count, plural, one {# question} other {# questions}}", {
          answered: block.answered,
          count: block.questions,
        })
      : [t("Up next"), time].join(" · ");
  };
}

function SegmentPopover({
  children,
  focusable,
  label,
}: {
  children: React.ReactNode;
  focusable: boolean;
  label: string;
}) {
  return (
    <PopoverTrigger
      aria-label={label}
      className={TRIGGER_CLASS}
      data-slot={DAY_SEGMENT_SLOT}
      tabIndex={focusable ? 0 : -1}
    >
      {children}
    </PopoverTrigger>
  );
}

function SegmentContent({
  facts,
  kind,
  note,
  title,
}: {
  facts: string;
  kind: LearnKind;
  note?: string;
  title: string;
}) {
  return (
    <PopoverContent align="start" className="w-64 gap-1.5 p-3" side="bottom">
      <PopoverHeader className="gap-0.5">
        <PopoverTitle className="flex items-center gap-1.5">
          <KindMark kind={kind} />
          <span className="min-w-0">{title}</span>
        </PopoverTitle>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">{facts}</p>
      </PopoverHeader>
      {note && <PopoverDescription>{note}</PopoverDescription>}
    </PopoverContent>
  );
}

export function BlockSegment({ focusable, part }: { focusable: boolean; part: DayStepPart }) {
  const blockTitle = useBlockTitle();
  const kindNote = useKindNote();
  const segmentFacts = useSegmentFacts();
  const title = blockTitle(part.block);
  const facts = segmentFacts({ block: part.block, state: part.state });

  return (
    <Popover>
      <SegmentPopover focusable={focusable} label={`${title}: ${facts}`}>
        <DaySegment kind={part.kind} share={part.share} state={part.state} />
      </SegmentPopover>
      <SegmentContent facts={facts} kind={part.kind} note={kindNote(part.kind)} title={title} />
    </Popover>
  );
}

/** The day's time kept for lessons that aren't on its list yet. */
export function HeldSegment({ minutes }: { minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today, writingStalled } = useTodayScreen();
  const title = t("Your next lessons");
  const time = formatDuration(minutes);

  const coming = writingStalled ? t("Taking longer than usual") : t("Getting ready…");
  const note = today.session.lessonsToPrepare ? t("Not ready yet") : coming;

  return (
    <Popover>
      <SegmentPopover focusable={false} label={`${title}: ${time}`}>
        <DaySegment kind="lesson" state="ahead" />
      </SegmentPopover>
      <SegmentContent facts={time} kind="lesson" note={note} title={title} />
    </Popover>
  );
}
