"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { TaskHeaderProgress } from "../_components/task-header";
import { TASK_MAIN_ACTION_CLASS, TaskActions } from "../_components/task-layout";
import {
  MockAnswerSheet,
  MockQuestionMap,
  SheetLegend,
  useMockSheetAside,
} from "./mock-answer-sheet";
import { ClockTitle } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { MockHandInDialog } from "./mock-hand-in";
import { FLAG_KEY, countLetteredOptions, isFlagKeyFree } from "./mock-keys";
import { useMockTitle } from "./mock-labels";
import { ItemClock, MovesNote } from "./mock-moves";
import { getSectionPlace } from "./mock-place";
import { MockQuestionCard, MockRecording, useQuestionPlace } from "./mock-question";
import { useSectionCounts } from "./mock-section-counts";

const PERCENT = 100;

/**
 * Where the learner is in the section, under the header: the in-column bar of questions answered,
 * then one mono line with the question's subject on the left (after the mock's name on a phone,
 * whose header shows the clock) and its place in the section on the right, counted like the bar,
 * the question's own clock beside it where the exam times each one. Screen readers hear the
 * question by its number on the answer sheet.
 */
function RunnerProgress({ question }: { question: MockQuestion }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const counts = useSectionCounts();
  const title = useMockTitle();
  const place = useQuestionPlace(question);

  const inSection = getSectionPlace({
    position: runner.position,
    questions: runner.view.current?.questions ?? [],
  });

  return (
    <>
      <TaskHeaderProgress
        label={t("Questions answered in this section")}
        value={counts.total > 0 ? (counts.answered / counts.total) * PERCENT : 0}
      />
      <div
        className="text-muted-foreground max-w-column mx-auto flex w-full items-center justify-between gap-3 px-4 pt-1.5 pb-1 font-mono text-xs tabular-nums"
        data-slot="mock-meta"
      >
        <span aria-hidden="true" className="min-w-0 truncate">
          <span className="lg:hidden">
            {title(runner.view)}
            {question.area && " · "}
          </span>
          {question.area}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <ItemClock />
          <span aria-hidden="true">
            {inSection
              ? t("{number} of {total}", {
                  number: String(inSection.number),
                  total: String(inSection.total),
                })
              : t("Written part")}
          </span>
        </span>
        <span className="sr-only">{place}</span>
      </div>
    </>
  );
}

/**
 * Flag the question to come back to it: a secondary beside Next, amber while it's flagged. F flags
 * it too, its keycap on the button where there's a keyboard, unless the question has an option F,
 * which keeps its letter.
 */
function FlagButton() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const question = runner.view.current?.questions[runner.position];
  const flagged = Boolean(question && runner.drafts[question.itemId]?.flagged);

  const keyFree =
    question !== undefined &&
    isFlagKeyFree(countLetteredOptions({ question, scoring: runner.view.scoring }));

  const toggleByKey = () => {
    if (!keyFree) {
      return false;
    }

    runner.toggleFlag();
  };

  const screenKey = { mode: "none", screen: true } as const;

  // Caps Lock sends the capital.
  useKeyboardCallback(FLAG_KEY, toggleByKey, screenKey);
  useKeyboardCallback(FLAG_KEY.toUpperCase(), toggleByKey, screenKey);

  return (
    <Button
      aria-keyshortcuts={keyFree ? FLAG_KEY.toUpperCase() : undefined}
      aria-pressed={flagged}
      className={cn("shrink-0", flagged && "border-warning text-warning hover:text-warning")}
      onClick={runner.toggleFlag}
      size="xl"
      variant="outline"
    >
      <FlagIcon aria-hidden="true" className={cn(flagged && "fill-current")} />
      {t("Flag")}
      {keyFree && <ShortcutKbd>{FLAG_KEY.toUpperCase()}</ShortcutKbd>}
    </Button>
  );
}

function RunnerFooter({ onHandIn }: { onHandIn: () => void }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const total = runner.view.current?.questions.length ?? 0;
  const isLastQuestion = runner.position >= total - 1;
  const isLastSection = runner.view.sections.at(-1)?.status === "current";
  const waiting = !runner.moves.canAdvance;

  function next() {
    if (waiting) {
      return;
    }

    if (isLastQuestion) {
      onHandIn();
      return;
    }

    runner.go(runner.position + 1);
  }

  const screenKey = { mode: "none", screen: true } as const;

  // Enter moves on after a key picked an answer; handing in stays a deliberate click.
  useEnterKey(() => runner.go(runner.position + 1), {
    enabled: !isLastQuestion && !runner.pending && !waiting,
  });

  useKeyboardCallback("ArrowRight", () => !waiting && runner.go(runner.position + 1), screenKey);
  useKeyboardCallback("ArrowLeft", () => runner.go(runner.position - 1), screenKey);

  const nextLabel = isLastSection ? t("Hand in the mock exam") : t("Hand in this section");
  // Also when the clock hands the section in, wherever the learner is.
  const handingIn = runner.busy === "submit";

  return (
    <>
      <MockStepStatus />
      <TaskActions>
        <FlagButton />
        <Button
          aria-keyshortcuts={isLastQuestion ? undefined : "Enter ArrowRight"}
          className={cn(TASK_MAIN_ACTION_CLASS, handingIn && "disabled:opacity-100")}
          disabled={runner.pending || waiting}
          onClick={next}
          size="xl"
        >
          {handingIn && <Spinner aria-hidden="true" />}
          {handingIn && t("Handing in…")}
          {!handingIn && isLastQuestion && nextLabel}
          {!handingIn && !isLastQuestion && (
            <>
              {t("Next")}
              <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
            </>
          )}
        </Button>
      </TaskActions>
    </>
  );
}

/**
 * The running section, like the exam room: the clock, one question at a time with no feedback,
 * Flag and Next at the thumb, and the answer sheet to jump around, read the section's notes and
 * hand it in after saying what's still blank or flagged. On a phone the sheet's row of the
 * question sits under it and the whole sheet opens from the header; from `lg` the sheet is the
 * aside, clock on top. When the clock runs out, answers close and hand-in waits for a click.
 */
function RunnerScreen({ deadline, question }: { deadline: string; question: MockQuestion }) {
  const [confirming, setConfirming] = useState(false);
  const handIn = () => setConfirming(true);
  const sheet = useMockSheetAside({ deadline, onHandIn: handIn });

  return (
    <MockFrame
      aside={sheet}
      footer={<RunnerFooter onHandIn={handIn} />}
      headerEnd={<MockAnswerSheet onHandIn={handIn} />}
      headerTitle={<ClockTitle clockBeside deadline={deadline} />}
      progress={{ bar: <RunnerProgress question={question} /> }}
    >
      <MockRecording key={question.set?.id ?? "none"} question={question} />
      <MockQuestionCard key={question.itemId} question={question} />
      <div className="flex flex-col gap-2.5">
        <MockQuestionMap className="lg:hidden" />
        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
          <SheetLegend className="lg:hidden" />
          <MovesNote />
        </div>
      </div>
      <MockHandInDialog onOpenChange={setConfirming} open={confirming} />
    </MockFrame>
  );
}

export function MockRunnerView() {
  const { runner } = useMockScreen();
  const { current } = runner.view;
  const question = current?.questions[runner.position];

  if (!current || !question) {
    return null;
  }

  return <RunnerScreen deadline={current.deadline} question={question} />;
}
