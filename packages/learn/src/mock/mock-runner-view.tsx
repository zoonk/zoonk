"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useShortcut } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { QuestionActions, QuestionMainAction } from "../_components/question-actions";
import { TaskHeaderProgress } from "../_components/task-header";
import { TASK_COLUMN_CLASS } from "../_components/task-layout";
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
import { useMockTitle } from "./mock-labels";
import { ItemClock, MovesNote } from "./mock-moves";
import { getSectionPlace } from "./mock-place";
import { MockQuestionCard, MockRecording, useQuestionPlace } from "./mock-question";
import { useSectionCounts } from "./mock-section-counts";

const PERCENT = 100;

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
        className={cn(
          TASK_COLUMN_CLASS,
          "text-muted-foreground flex items-center justify-between gap-3 pt-1.5 pb-1 font-mono text-xs tabular-nums",
        )}
        data-slot="mock-meta"
      >
        <span aria-hidden="true" className="min-w-0 truncate">
          <span className="with-aside:hidden">
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

function FlagButton() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const question = runner.view.current?.questions[runner.position];
  const flagged = Boolean(question && runner.drafts[question.itemId]?.flagged);

  useShortcut("flag", runner.toggleFlag);

  return (
    <Button
      aria-keyshortcuts={shortcutKeys("flag")}
      aria-pressed={flagged}
      className={cn(
        "shrink-0",
        flagged && "border-warning text-warning-text hover:text-warning-text",
      )}
      onClick={runner.toggleFlag}
      size="xl"
      variant="outline"
    >
      <FlagIcon aria-hidden="true" className={cn(flagged && "fill-current")} />
      {t("Flag")}
      <ShortcutKbd shortcut="flag" />
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

  // Enter moves on after a key picked an answer; handing in stays a deliberate click.
  useShortcut("next", () => !waiting && runner.go(runner.position + 1));
  useShortcut("previous", () => runner.go(runner.position - 1));

  const nextLabel = isLastSection ? t("Hand in the mock exam") : t("Hand in this section");
  const handingIn = runner.busy === "submit";

  return (
    <>
      <MockStepStatus />
      <QuestionActions>
        <FlagButton />
        {isLastQuestion ? (
          <QuestionMainAction
            action="finish"
            busy={handingIn}
            disabled={runner.pending || waiting}
            enter="off"
            onPress={next}
          >
            {nextLabel}
          </QuestionMainAction>
        ) : (
          <QuestionMainAction
            action="next"
            aria-keyshortcuts={`${shortcutKeys("main")} ${shortcutKeys("next")}`}
            disabled={runner.pending || waiting}
            onPress={next}
          />
        )}
      </QuestionActions>
    </>
  );
}

function RunnerScreen({ deadline, question }: { deadline: string; question: MockQuestion }) {
  const t = useExtracted();
  const [confirming, setConfirming] = useState(false);
  const handIn = () => setConfirming(true);
  const sheet = useMockSheetAside({ deadline, onHandIn: handIn });

  return (
    <MockFrame
      aside={sheet}
      confirmExit={{
        cancel: t("Stay"),
        confirm: t("Leave"),
        description: t("Your answers are saved. The clock keeps running while you're away."),
        title: t("Leave the mock exam?"),
      }}
      footer={<RunnerFooter onHandIn={handIn} />}
      headerEnd={<MockAnswerSheet onHandIn={handIn} />}
      headerTitle={<ClockTitle clockBeside deadline={deadline} />}
      progress={{ bar: <RunnerProgress question={question} /> }}
    >
      <MockRecording key={question.set?.id ?? "none"} question={question} />
      <MockQuestionCard key={question.itemId} question={question} />
      <div className="flex flex-col gap-2.5">
        <MockQuestionMap className="with-aside:hidden" />
        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
          <SheetLegend className="with-aside:hidden" />
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
