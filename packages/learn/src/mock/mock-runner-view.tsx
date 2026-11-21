"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverDescription,
} from "@zoonk/ui/components/popover";
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

function useUnsureTip(itemId: string | undefined) {
  const [tipFor, setTipFor] = useState<string | null>(null);
  const [shownItem, setShownItem] = useState(itemId);

  // Any move to another question closes it, so coming back never shows it without a press.
  if (shownItem !== itemId) {
    setShownItem(itemId);
    setTipFor(null);
  }

  return {
    close: () => setTipFor(null),
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

/**
 * The tip stands over the whole bottom bar, so the question strip under it stays in sight, and its
 * arrow points down at the button.
 */
function aboveBottomBar(button: HTMLElement | null) {
  if (!button) {
    return null;
  }

  return {
    contextElement: button,
    getBoundingClientRect: () => {
      const rect = button.getBoundingClientRect();
      const barTop = button.closest('[data-slot="bottom-bar"]')?.getBoundingClientRect().top;
      const top = barTop ?? rect.top;

      return new DOMRect(rect.left, top, rect.width, rect.bottom - top);
    },
  };
}

function useUnsureTipText() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  return runner.moves.canRecheck
    ? t("Check it again before you hand in. Your result shows how these answers went.")
    : t("Your result shows how these answers went.");
}

function UnsureButton() {
  const label = useUnsureLabel();
  const { runner } = useMockScreen();
  const question = runner.view.current?.questions[runner.position];
  const unsure = Boolean(question && runner.drafts[question.itemId]?.flagged);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useUnsureTip(question?.itemId);
  const tipId = useId();
  const tipText = useUnsureTipText();

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
          anchor={() => aboveBottomBar(button.current)}
          backdrop={false}
          className="w-64 max-w-(--available-width)"
          collisionAvoidance={{ side: "none" }}
          finalFocus={false}
          initialFocus={false}
          side="top"
          sideOffset={4}
        >
          <PopoverDescription className="text-popover-foreground text-pretty" id={tipId}>
            {tipText}
          </PopoverDescription>
          <PopoverArrow />
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
