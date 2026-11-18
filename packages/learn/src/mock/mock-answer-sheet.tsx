"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { cn } from "@zoonk/ui/lib/utils";
import { PenLineIcon, PencilRulerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SheetHeader } from "../_components/sheet-header";
import { type TaskFrameAside } from "../shell/task-frame";
import { countsTowardMockProgress } from "./mock-answer-progress";
import { SectionClock } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MovesNote } from "./mock-moves";
import { useSectionCounts } from "./mock-section-counts";
import { SheetSections } from "./mock-sheet-sections";

function useSheetCountLine(): string {
  const t = useExtracted();
  const { answered } = useSectionCounts();

  return t("{answered, plural, =0 {# answered} one {# answered} other {# answered}}", { answered });
}

const CELL_FILLED_CLASS =
  "bg-surface-3 text-foreground enabled:hover:bg-surface-3 ring-transparent";

const CELL_CURRENT_CLASS = "ring-foreground ring-2";

const CELL_FLAGGED_CLASS = "text-warning-text ring-warning ring-2";

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

  const label = isEssay
    ? t("Written part")
    : t("Question {number}", { number: String(question.number) });

  return (
    <button
      aria-current={isCurrent ? "true" : undefined}
      aria-label={draft?.flagged ? t("{question}, marked for review", { question: label }) : label}
      className={cn(
        "focus-visible:outline-ring text-muted-foreground ring-border enabled:hover:bg-muted/60 relative flex h-11 w-full items-center justify-center rounded-lg font-mono text-sm font-medium tabular-nums ring-1 transition-colors outline-none ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:opacity-40 motion-reduce:transition-none",
        countsTowardMockProgress(runner, question.itemId) && CELL_FILLED_CLASS,
        draft?.flagged && CELL_FLAGGED_CLASS,
        isCurrent && cn(CELL_CURRENT_CLASS, !draft?.flagged && "text-foreground"),
      )}
      disabled={!runner.moves.canOpen(index)}
      onClick={() => onPick(index)}
      type="button"
    >
      {isEssay ? <PenLineIcon aria-hidden="true" className="size-4" /> : question.number}
      {draft?.flagged && (
        <span
          aria-hidden="true"
          className="bg-warning absolute inset-e-1 top-1 size-1 rounded-full"
        />
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
          <QuestionCell index={index} onPick={onPick} question={question} />
        </li>
      ))}
    </ol>
  );
}

const SCROLL_FADE_PX = 64;

export function MockQuestionMap({ className }: { className?: string }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];
  const row = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const scroll = row.current?.parentElement;
    const current = row.current?.children[runner.position];

    if (!scroll || !current) {
      return;
    }

    function keepCurrentInView() {
      if (!scroll?.clientWidth || !current) {
        return;
      }

      const viewport = scroll.getBoundingClientRect();
      const cell = current.getBoundingClientRect();
      const inset = Math.min(SCROLL_FADE_PX, cell.width);
      const left = cell.left - viewport.left - inset;
      const right = cell.right - viewport.right + inset;

      if (left < 0 || right > 0) {
        scroll.scrollBy({ left: left < 0 ? left : right });
      }
    }

    keepCurrentInView();
    const resized = new ResizeObserver(keepCurrentInView);
    resized.observe(scroll);
    return () => resized.disconnect();
  }, [runner.position]);

  if (questions.length <= 1) {
    return null;
  }

  return (
    <HorizontalScroll
      className={className}
      labels={{ left: t("Earlier questions"), right: t("Later questions") }}
    >
      <ol
        aria-label={t("Questions")}
        className="flex w-max min-w-full gap-2 p-0.5"
        data-slot="mock-question-map"
        ref={row}
      >
        {questions.map((question, index) => (
          <li className="w-11 shrink-0 grow" key={question.itemId}>
            <QuestionCell index={index} onPick={runner.go} question={question} />
          </li>
        ))}
      </ol>
    </HorizontalScroll>
  );
}

function SheetLegend() {
  const t = useExtracted();
  const { flagged } = useSectionCounts();

  const states = [
    { label: t("Unanswered"), style: "ring-border" },
    { label: t("Answered"), style: CELL_FILLED_CLASS },
    { label: t("Current question"), style: CELL_CURRENT_CLASS },
    {
      label: t(
        "{flagged, plural, =0 {Marked for review} one {# marked for review} other {# marked for review}}",
        { flagged },
      ),
      style: CELL_FLAGGED_CLASS,
    },
  ];

  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
      {states.map((state) => (
        <li className="flex items-center gap-1.5" key={state.label}>
          <span
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 rounded-sm ring-1 ring-inset", state.style)}
          />
          {state.label}
        </li>
      ))}
    </ul>
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
      aria-haspopup="dialog"
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
    title: <span className="text-sm tracking-normal normal-case">{t("Answer sheet")}</span>,
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

        <DrawerFooter>
          <SheetHandIn
            onHandIn={() => {
              setOpen(false);
              onHandIn();
            }}
          />
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
