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
import { FactSegments } from "../_components/task-meta";
import { type TaskFrameAside } from "../shell/task-frame";
import { countsTowardMockProgress } from "./mock-answer-progress";
import { SectionClock } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { UnsureMark } from "./mock-labels";
import { MovesNote } from "./mock-moves";
import { useSectionCounts } from "./mock-section-counts";
import { SheetSections } from "./mock-sheet-sections";
import { useQuestionCellLabel } from "./use-question-cell-label";

function SheetCountLine() {
  const t = useExtracted();
  const { answered, unsure } = useSectionCounts();

  return (
    <FactSegments
      facts={[
        t("{answered, plural, =0 {# answered} one {# answered} other {# answered}}", { answered }),
        unsure > 0 &&
          t({
            description:
              'On the mock exam\'s answer sheet: how many answers the learner marked with the "Not sure" button.',
            message: "{unsure, plural, one {# not sure} other {# not sure}}",
            values: { unsure },
          }),
      ]}
    />
  );
}

const CELL_FILLED_CLASS =
  "bg-selected-tint text-foreground enabled:hover:bg-selected-tint contrast-more:ring-input ring-transparent";

const CELL_CURRENT_CLASS =
  "after:bg-foreground after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full";

/** A "Not sure" mark is a tint in its own color, never a ring; an answered one keeps its number in ink. */
const CELL_UNSURE_CLASS =
  "bg-warning/14 enabled:hover:bg-warning/14 contrast-more:ring-warning ring-transparent contrast-more:ring-2";

function QuestionCell({
  index,
  onPick,
  question,
}: {
  index: number;
  onPick: (position: number) => void;
  question: MockQuestion;
}) {
  const { runner } = useMockScreen();
  const draft = runner.drafts[question.itemId];
  const isEssay = question.format === "essay";
  const isCurrent = index === runner.position;
  const isAnswered = countsTowardMockProgress(runner, question.itemId);

  const unsure = Boolean(draft?.flagged);
  const label = useQuestionCellLabel({ question, unsure });

  return (
    <button
      aria-current={isCurrent ? "true" : undefined}
      aria-label={label}
      className={cn(
        "focus-visible:outline-ring/50 text-muted-foreground ring-border enabled:hover:bg-muted/60 relative flex h-11 w-full items-center justify-center rounded-lg font-mono text-sm font-medium tabular-nums ring-1 transition-colors outline-none ring-inset focus-visible:outline-3 focus-visible:outline-solid disabled:opacity-40 motion-reduce:transition-none",
        isAnswered && CELL_FILLED_CLASS,
        unsure && cn(CELL_UNSURE_CLASS, !isAnswered && "text-warning-text"),
        isCurrent && cn(CELL_CURRENT_CLASS, !unsure && "text-foreground"),
      )}
      disabled={!runner.moves.canOpen(index)}
      onClick={() => onPick(index)}
      type="button"
    >
      {isEssay ? <PenLineIcon aria-hidden="true" className="size-4" /> : question.number}
      {unsure && <UnsureMark className="text-warning absolute inset-e-1.5 top-0" />}
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
      box={{ label: t("Questions") }}
      className={className}
      labels={{ left: t("Earlier questions"), right: t("Later questions") }}
    >
      <ol className="flex w-max min-w-full gap-2 p-0.5" data-slot="mock-question-map" ref={row}>
        {questions.map((question, index) => (
          <li className="w-11 shrink-0 grow" key={question.itemId}>
            <QuestionCell index={index} onPick={runner.go} question={question} />
          </li>
        ))}
      </ol>
    </HorizontalScroll>
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
  withCount = false,
  withMoves = false,
}: {
  onPick: (position: number) => void;
  withCount?: boolean;
  withMoves?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {withCount && (
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            <SheetCountLine />
          </p>
        )}
        <SheetGrid onPick={onPick} />
        {withMoves && (
          <div className="text-muted-foreground text-xs empty:hidden">
            <MovesNote />
          </div>
        )}
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

  return {
    children: (
      <>
        <SectionClock deadline={deadline} place="aside" />
        <MockSheetContent onPick={runner.go} withCount />
      </>
    ),
    footer: <SheetHandIn onHandIn={onHandIn} />,
    label: t("Answer sheet"),
    title: t("Answer sheet"),
  };
}

export function MockAnswerSheet({ onHandIn }: { onHandIn: () => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const [open, setOpen] = useState(false);

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger
        aria-label={t("Answer sheet")}
        render={<Button className="with-aside:hidden shrink-0" size="sm" variant="outline" />}
      >
        {t({
          description:
            'Short label of a small button that opens the mock exam\'s answer sheet. Screen readers and voice control call the button "Answer sheet", so the label must be a word copied letter for letter from your translation of "Answer sheet", such as its first word.',
          message: "Sheet",
        })}
      </DrawerTrigger>

      <DrawerPopup>
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <DrawerTitle>{t("Answer sheet")}</DrawerTitle>
            <DrawerDescription className="font-mono text-xs tabular-nums">
              <SheetCountLine />
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
