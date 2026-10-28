"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { HistoryIcon, PenLineIcon, PencilRulerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { type TaskFrameAside } from "../shell/task-frame";
import { SectionClock } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MovesNote } from "./mock-moves";
import { useMockShortLine } from "./mock-notes";
import { useSectionCounts } from "./mock-section-counts";
import { SheetSections } from "./mock-sheet-sections";
import { isDraftAnswered } from "./use-mock-drafts";

function useSheetCountLine(): string {
  const t = useExtracted();
  const { answered, flagged } = useSectionCounts();

  return t(
    "{answered, plural, =0 {# answered} one {# answered} other {# answered}} · {flagged, plural, =0 {# flagged} one {# flagged} other {# flagged}}",
    { answered, flagged },
  );
}

const CELL_SIZE = {
  row: { cell: "h-7 rounded-[0.375rem] text-xs", essay: "size-3.5" },
  sheet: { cell: "h-11 rounded-lg text-sm", essay: "size-4" },
} as const;

function QuestionCell({
  index,
  onPick,
  question,
  size,
}: {
  index: number;
  onPick: (position: number) => void;
  question: MockQuestion;
  size: keyof typeof CELL_SIZE;
}) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const draft = runner.drafts[question.itemId];
  const isEssay = question.format === "essay";
  const isCurrent = index === runner.position;

  return (
    <button
      aria-current={isCurrent ? "true" : undefined}
      aria-label={
        isEssay ? t("Written part") : t("Question {number}", { number: String(question.number) })
      }
      className={cn(
        "focus-visible:outline-ring text-muted-foreground ring-border enabled:hover:bg-muted/60 hit-area relative flex w-full items-center justify-center font-mono font-medium tabular-nums ring-1 transition-colors outline-none ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:opacity-40 motion-reduce:transition-none",
        CELL_SIZE[size].cell,
        isDraftAnswered(draft) &&
          "bg-surface-3 text-foreground enabled:hover:bg-surface-3 ring-transparent",
        draft?.flagged && "text-warning-text ring-warning ring-[1.5px]",
        isCurrent && "text-foreground ring-success ring-2",
      )}
      disabled={!runner.moves.canOpen(index)}
      onClick={() => onPick(index)}
      type="button"
    >
      {isEssay ? (
        <PenLineIcon aria-hidden="true" className={CELL_SIZE[size].essay} />
      ) : (
        question.number
      )}
    </button>
  );
}

function SheetGrid({ onPick }: { onPick: (position: number) => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];

  return (
    <ol
      aria-label={t("Questions")}
      className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2"
    >
      {questions.map((question, index) => (
        <li key={question.itemId}>
          <QuestionCell index={index} onPick={onPick} question={question} size="sheet" />
        </li>
      ))}
    </ol>
  );
}

const MAP_ROW = 9;

export function MockQuestionMap({ className }: { className?: string }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];

  if (questions.length <= 1) {
    return null;
  }

  const start = Math.floor(runner.position / MAP_ROW) * MAP_ROW;

  return (
    <ol
      aria-label={t("Questions")}
      className={cn("grid grid-cols-9 gap-1.5", className)}
      data-slot="mock-question-map"
    >
      {questions.slice(start, start + MAP_ROW).map((question, offset) => (
        <li key={question.itemId}>
          <QuestionCell index={start + offset} onPick={runner.go} question={question} size="row" />
        </li>
      ))}
    </ol>
  );
}

export function SheetLegend({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <p className={cn("text-muted-foreground flex items-start gap-1.5 text-xs", className)}>
      <span
        aria-hidden="true"
        className="ring-warning mt-1 size-2 shrink-0 rounded-[2px] ring-[1.5px] ring-inset"
      />
      {t("flagged · no feedback until the end, like on exam day")}
    </p>
  );
}

function SheetNotes() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const reused = runner.view.reusedQuestions;
  const short = useMockShortLine(runner.view);
  const tools = runner.view.sections.find((section) => section.status === "current")?.tools;

  if (!tools && !short && reused === 0) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-col gap-1.5 text-xs [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      {tools && (
        <p className="flex items-start gap-1.5">
          <PencilRulerIcon aria-hidden="true" />
          {tools}
        </p>
      )}
      {short && <p>{short}</p>}
      {reused > 0 && (
        <p className="flex items-start gap-1.5">
          <HistoryIcon aria-hidden="true" />
          {t(
            "{count, plural, one {# question repeats.} other {# questions repeat, missed ones first.}}",
            { count: reused },
          )}
        </p>
      )}
    </div>
  );
}

function MockSheetContent({
  onPick,
  withMoves = false,
}: {
  onPick: (position: number) => void;
  withMoves?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SheetGrid onPick={onPick} />
        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
          <SheetLegend />
          {withMoves && <MovesNote />}
        </div>
      </div>
      <SheetNotes />
      <SheetSections />
    </div>
  );
}

function SheetHandIn({ onHandIn }: { onHandIn: () => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();

  return (
    <Button
      className="w-full"
      disabled={runner.pending}
      onClick={onHandIn}
      size="xl"
      variant="outline"
    >
      {t("Hand in")}
    </Button>
  );
}

export function useMockSheetAside({
  deadline,
  onHandIn,
}: {
  deadline: string;
  onHandIn: () => void;
}): TaskFrameAside {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const counts = useSheetCountLine();

  return {
    children: (
      <>
        <SectionClock deadline={deadline} place="aside" />
        <MockSheetContent onPick={runner.go} />
      </>
    ),
    footer: <SheetHandIn onHandIn={onHandIn} />,
    label: t("Answer sheet"),
    meta: counts,
    title: t("Answer sheet"),
  };
}

export function MockAnswerSheet({ onHandIn }: { onHandIn: () => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const [open, setOpen] = useState(false);
  const counts = useSheetCountLine();

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger
        aria-label={t("Answer sheet")}
        render={<Button className="shrink-0 lg:hidden" size="sm" variant="outline" />}
      >
        {t("Sheet")}
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">{t("Answer sheet")}</DrawerTitle>
            <DrawerDescription className="font-mono text-xs tabular-nums">
              {counts}
            </DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="pt-2">
          <MockSheetContent
            onPick={(position) => {
              runner.go(position);
              setOpen(false);
            }}
            withMoves
          />
        </DrawerContent>

        <div className="border-border border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHandIn
            onHandIn={() => {
              setOpen(false);
              onHandIn();
            }}
          />
        </div>
      </DrawerPopup>
    </Drawer>
  );
}
