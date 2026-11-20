"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Popover, PopoverContent, PopoverDescription } from "@zoonk/ui/components/popover";
import { useShortcut } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { BookmarkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { Eyebrow } from "../_components/eyebrow";
import { QuestionActions, QuestionMainAction } from "../_components/question-actions";
import { TaskHeaderProgress } from "../_components/task-header";
import { TASK_COLUMN_CLASS } from "../_components/task-layout";
import { deviceStorage } from "../_utils/device-storage";
import { MockAnswerSheet, MockQuestionMap, useMockSheetAside } from "./mock-answer-sheet";
import { ClockTitle } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MockFrame } from "./mock-frame";
import { MockHandInDialog } from "./mock-hand-in";
import { useMockTitle, useUnsureLabel } from "./mock-labels";
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
          "text-muted-foreground flex items-center justify-between gap-3 pt-1.5 pb-1",
        )}
        data-slot="mock-meta"
      >
        <Eyebrow aria-hidden="true" className={cn(!question.area && "with-aside:hidden")}>
          <span className="with-aside:hidden">
            {title(runner.view)}
            {question.area && " · "}
          </span>
          {question.area}
        </Eyebrow>
        <span className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
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

const UNSURE_TIP_SEEN_KEY = "zoonk:mock-unsure-tip-seen";

/** The first time a learner marks an answer on this device, a tip says what the mark is for. */
function useUnsureTip(itemId: string | undefined) {
  const [tipFor, setTipFor] = useState<string | null>(null);

  return {
    close: () => setTipFor(null),
    // Kept per question, so moving to another one closes it.
    open: tipFor === itemId,
    toggled: (marking: boolean) => {
      const show = marking && deviceStorage.get(UNSURE_TIP_SEEN_KEY) === null;

      if (show) {
        deviceStorage.set(UNSURE_TIP_SEEN_KEY, "1");
      }

      setTipFor(show && itemId ? itemId : null);
    },
  };
}

function UnsureButton() {
  const t = useExtracted();
  const label = useUnsureLabel();
  const { runner } = useMockScreen();
  const question = runner.view.current?.questions[runner.position];
  const unsure = Boolean(question && runner.drafts[question.itemId]?.flagged);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useUnsureTip(question?.itemId);
  const tipId = useId();

  function toggle() {
    tip.toggled(!unsure);
    runner.toggleUnsure();
  }

  useShortcut("unsure", toggle);

  return (
    <>
      <Button
        aria-describedby={tip.open ? tipId : undefined}
        aria-keyshortcuts={shortcutKeys("unsure")}
        aria-pressed={unsure}
        className={cn(
          "shrink-0",
          unsure && "border-warning text-warning-text hover:text-warning-text",
        )}
        onClick={toggle}
        ref={button}
        size="xl"
        variant="outline"
      >
        <BookmarkIcon aria-hidden="true" className={cn(unsure && "fill-current")} />
        {label}
      </Button>

      <Popover onOpenChange={(open) => !open && tip.close()} open={tip.open}>
        <PopoverContent
          anchor={button}
          backdrop={false}
          className="w-64 max-w-(--available-width)"
          finalFocus={false}
          initialFocus={false}
          side="top"
        >
          <PopoverDescription className="text-pretty" id={tipId}>
            {t("Check it again before you hand in. Your result shows how these answers went.")}
          </PopoverDescription>
        </PopoverContent>
      </Popover>
    </>
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

  const nextLabel = isLastSection ? t("Hand in") : t("Hand in section");
  const handingIn = runner.busy === "submit";

  return (
    <>
      {/* In the bar, so the numbers stay in one place whatever a question's length. */}
      <MockQuestionMap className="with-aside:hidden w-full" />
      <QuestionActions className="w-full lg:w-auto">
        <UnsureButton />
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
      <div className="text-muted-foreground text-xs empty:hidden">
        <MovesNote />
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
