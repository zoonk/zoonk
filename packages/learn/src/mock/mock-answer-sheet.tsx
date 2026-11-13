"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { PenLineIcon, PencilRulerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SheetHeader } from "../_components/sheet-header";
import { BAR_PADDING_CLASS } from "../_components/task-layout";
import { type TaskFrameAside } from "../shell/task-frame";
import { SectionClock } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MovesNote } from "./mock-moves";
import { useSectionCounts } from "./mock-section-counts";
import { SheetSections } from "./mock-sheet-sections";
import { isDraftAnswered } from "./use-mock-drafts";

function useSheetCountLine(): string {
  const t = useExtracted();
  const { answered } = useSectionCounts();

  return t("{answered, plural, =0 {# answered} one {# answered} other {# answered}}", { answered });
}

function QuestionCell({
  index,
  onPick,
  question,
}: {
  index: number;
  onPick: (position: number) => void;
  question: MockQuestion;
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
        "focus-visible:outline-ring text-muted-foreground ring-border enabled:hover:bg-muted/60 relative flex h-11 w-full items-center justify-center rounded-lg font-mono text-sm font-medium tabular-nums ring-1 transition-colors outline-none ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:opacity-40 motion-reduce:transition-none",
        isDraftAnswered(draft) &&
          "bg-surface-3 text-foreground enabled:hover:bg-surface-3 ring-transparent",
        draft?.flagged && "text-warning-text ring-warning ring-2",
        isCurrent && cn("ring-foreground ring-2", !draft?.flagged && "text-foreground"),
      )}
      disabled={!runner.moves.canOpen(index)}
      onClick={() => onPick(index)}
      type="button"
    >
      {isEssay ? <PenLineIcon aria-hidden="true" className="size-4" /> : question.number}
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
          <QuestionCell index={index} onPick={onPick} question={question} />
        </li>
      ))}
    </ol>
  );
}

/** Seven 44 px numbers fit a phone's width with room between them, so no two press areas overlap. */
const MAP_ROW = 7;

export function MockQuestionMap({ className }: { className?: string }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];

  if (questions.length <= 1) {
    return null;
  }

  // The last stretch still shows a full row, so the current question is never a lone cell.
  const start = Math.max(
    0,
    Math.min(Math.floor(runner.position / MAP_ROW) * MAP_ROW, questions.length - MAP_ROW),
  );

  return (
    <ol
      aria-label={t("Questions")}
      className={cn("grid grid-cols-7 gap-2", className)}
      data-slot="mock-question-map"
    >
      {questions.slice(start, start + MAP_ROW).map((question, offset) => (
        <li key={question.itemId}>
          <QuestionCell index={start + offset} onPick={runner.go} question={question} />
        </li>
      ))}
    </ol>
  );
}

function SheetLegend({ className }: { className?: string }) {
  const t = useExtracted();
  const { flagged } = useSectionCounts();

  if (flagged === 0) {
    return null;
  }

  return (
    <p className={cn("text-muted-foreground flex items-start gap-1.5 text-xs", className)}>
      <span
        aria-hidden="true"
        className="ring-warning mt-1 size-2 shrink-0 rounded-xs ring-[1.5px] ring-inset"
      />
      {t("{flagged, plural, one {# flagged} other {# flagged}}", { flagged })}
    </p>
  );
}

function SheetNotes() {
  const { runner } = useMockScreen();
  const tools = runner.view.sections.find((section) => section.status === "current")?.tools;

  if (!tools) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      <PencilRulerIcon aria-hidden="true" />
      {tools}
    </p>
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
      focusableWhenDisabled
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
        render={<Button className="with-aside:hidden shrink-0" size="sm" variant="outline" />}
      >
        {t({
          description: "Short label of a small button that opens the mock exam's answer sheet.",
          message: "Sheet",
        })}
      </DrawerTrigger>

      <DrawerPopup>
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <DrawerTitle>{t("Answer sheet")}</DrawerTitle>
            <DrawerDescription className="font-mono text-xs tabular-nums">
              {counts}
            </DrawerDescription>
          </div>
        </SheetHeader>

        <DrawerContent className="pt-2">
          <MockSheetContent
            onPick={(position) => {
              runner.go(position);
              setOpen(false);
            }}
            withMoves
          />
        </DrawerContent>

        <div className={cn("border-border border-t px-6", BAR_PADDING_CLASS)}>
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
