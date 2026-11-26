"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { useExtracted } from "next-intl";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { FactSegments } from "../_components/task-meta";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { type DayStepPart } from "../session/day-meter-parts";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { DaySegment, type DaySegmentState } from "./day-segments";
import { useComingLessons } from "./today-coming-lessons";
import { useStepGettingReady } from "./use-today-copy";

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

/** A state is a word, set in the text face; a time or a count is data, set in mono. */
type SegmentFacts = { data?: string; status?: string };

function useSegmentFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const isGettingReady = useStepGettingReady();

  return ({ block, state }: { block: DayStep; state: DaySegmentState }): SegmentFacts => {
    const time = formatDuration(block.estimatedMinutes);

    if (state === "done") {
      return { status: t("Done") };
    }

    if (isGettingReady(block)) {
      return { data: time, status: t("Getting ready…") };
    }

    if (state === "ahead") {
      return { data: time, status: toLabelCase(t("planned")) };
    }

    return block.status === "active" && block.answered > 0
      ? {
          data: t("{answered, number} of {count, plural, one {# question} other {# questions}}", {
            answered: block.answered,
            count: block.questions,
          }),
        }
      : { data: time, status: t("Up next") };
  };
}

function factsLabel({ data, status }: SegmentFacts): string {
  return [status, data].filter(Boolean).join(FACT_SEPARATOR);
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
  facts: SegmentFacts;
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
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          <FactSegments
            facts={[facts.data]}
            lead={facts.status && <span className="font-sans">{facts.status}</span>}
          />
        </p>
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
      <SegmentPopover focusable={focusable} label={`${title}: ${factsLabel(facts)}`}>
        <DaySegment share={part.share} state={part.state} />
      </SegmentPopover>
      <SegmentContent facts={facts} kind={part.kind} note={kindNote(part.kind)} title={title} />
    </Popover>
  );
}

/** The day's time kept for lessons that aren't on its list yet. */
export function HeldSegment({ minutes }: { minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { asks, title } = useComingLessons();
  const time = formatDuration(minutes);
  const note = asks ? t("Not ready yet") : t("Getting ready…");

  return (
    <Popover>
      <SegmentPopover focusable={false} label={`${title}: ${time}`}>
        <DaySegment state="ahead" />
      </SegmentPopover>
      <SegmentContent facts={{ data: time }} kind="lesson" note={note} title={title} />
    </Popover>
  );
}
