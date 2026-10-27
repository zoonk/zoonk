"use client";

import { Button } from "@zoonk/ui/components/button";
import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { getStepMoves } from "../_utils/step-moves";
import { TaskFrame, type TaskFrameAside, TaskMainButton } from "../shell/task-frame";
import { STEP_TITLE_SLOT } from "./step-card";
import { StepDots } from "./step-dots";
import { useTaskAsideShown } from "./task-header";
import { TASK_BACK_ACTION_CLASS, TaskActions } from "./task-layout";

/** One thing to say, as its own step. Steps with nothing to say are left out by the caller. */
export type StepsItem = {
  /** A secondary action beside Continue on this step ("See mistakes"), left of the main one. */
  action?: React.ReactNode;
  /**
   * What it says sits in the `aside` from `lg`, so the steps there skip it (never the first step).
   * The server then draws both arrangements and the screen's width shows one, so a reload at any
   * width draws the steps that stay.
   */
  beside?: boolean;
  content: React.ReactNode;
  id: string;
  /**
   * A quiet option on its own row under this step's actions ("See the questions"), so the main
   * action keeps its room in a row it shares with the buddy.
   */
  option?: React.ReactNode;
  /**
   * A full-screen moment for this step (a ceremony), shown once as the learner reaches it, before
   * the step itself, so the step's own motion doesn't play hidden behind it. It calls `close` when
   * it's over, and the step takes the focus.
   */
  moment?: (close: () => void) => React.ReactNode;
};

/** Moves focus to the step's title, so a screen reader reads each step as it comes. */
export function focusStepTitle(container: HTMLElement | null) {
  container
    ?.querySelector<HTMLElement>(`[data-slot="${STEP_TITLE_SLOT}"]`)
    ?.focus({ preventScroll: true });
}

/** Back to the step before, the 44px square on the bar's left (← too, from `Steps`). */
export function StepsBackButton({ onClick }: { onClick: () => void }) {
  const t = useExtracted();

  return (
    <Button
      aria-keyshortcuts="ArrowLeft"
      aria-label={t("Back")}
      className={TASK_BACK_ACTION_CLASS}
      onClick={onClick}
      size="icon"
      variant="outline"
    >
      <ChevronLeftIcon aria-hidden="true" />
    </Button>
  );
}

/** What only wide screens show (`when`), the last step's actions there; otherwise as it is. */
function WideOnly({ children, when }: { children: React.ReactNode; when: boolean }) {
  return when ? <div className="contents max-lg:hidden">{children}</div> : children;
}

/**
 * A result told one thing at a time, full screen like a task: leave on the left (Escape too), dots
 * for where the learner is, the step on the page from the top of the column, and Continue (Enter)
 * in the pinned action bar, with Back beside it (← too). The last step has the screen's own
 * actions instead of Continue. From `lg` an `aside` can hold what the steps after the first tell
 * on a phone (what the day earned, the steps `beside` it), so a wide screen says it all at once.
 * The learner's buddy (`ask`) sits where it does on every task: after the main action on a phone,
 * at the aside's foot from `lg`. A step's celebration plays the first time it shows; going back to
 * it shows its end state.
 */
export function Steps({
  aside,
  ask,
  exitHref,
  finalAction,
  finalOptions,
  items,
}: {
  aside?: TaskFrameAside | null;
  /** "Ask {buddy}" about the result, as a task's buddy (`AskTutor` with the `task` size). */
  ask?: React.ReactNode;
  exitHref: string;
  /**
   * The last step's main action, in Continue's place (a `TaskMainButton` or `TaskMainLink`, which
   * binds its own Enter); a line about it, like an error, goes in `finalOptions`.
   */
  finalAction: React.ReactNode;
  /** Quiet options under the last step's main action. */
  finalOptions?: React.ReactNode;
  items: StepsItem[];
}) {
  const t = useExtracted();
  const asideShown = useTaskAsideShown();
  const [index, setIndex] = useState(0);
  const [momentsShown, setMomentsShown] = useState<string[]>([]);
  const [stepsLeft, setStepsLeft] = useState<string[]>([]);
  const stepRef = useRef<HTMLDivElement>(null);
  const focusedIndex = useRef(0);
  const reached = Math.min(index, items.length - 1);

  // A screen widened on a step that sits in the aside from `lg` shows the step before it.
  const current =
    asideShown && items[reached]?.beside
      ? Math.max(
          items.findLastIndex((step, position) => position < reached && !step.beside),
          0,
        )
      : reached;

  const item = items[current];
  const phone = getStepMoves({ current, steps: items, wide: false });
  const wide = getStepMoves({ current, steps: items, wide: true });
  // Some step sits beside the others from `lg`: each arrangement's dots and last-step actions are
  // drawn, and the screen's width shows its own (`lg:hidden`, `max-lg:hidden`).
  const split = items.some((step) => step.beside);
  const isLastHere = phone.next === -1;
  const isLastWide = wide.next === -1;

  // The width is known by the time a key or a tap moves a step.
  const move = (to: "back" | "next") => {
    const target = (asideShown ? wide : phone)[to];

    if (target === -1) {
      return false;
    }

    if (item && !stepsLeft.includes(item.id)) {
      setStepsLeft([...stepsLeft, item.id]);
    }

    setIndex(target);
  };

  const back = () => move("back");

  useKeyboardCallback("ArrowLeft", back, { mode: "none", screen: true });

  // A new step takes the focus, but the page's first one keeps it where the browser put it.
  useEffect(() => {
    if (focusedIndex.current === current) {
      return;
    }

    focusedIndex.current = current;
    focusStepTitle(stepRef.current);
  }, [current]);

  // Once a moment before the step closes, the step takes the focus.
  useEffect(() => {
    if (momentsShown.length > 0) {
      focusStepTitle(stepRef.current);
    }
  }, [momentsShown]);

  if (!item) {
    return null;
  }

  const moment = item.moment && !momentsShown.includes(item.id) ? item.moment : null;

  const closeMoment = () => setMomentsShown((shown) => [...shown, item.id]);

  return (
    <TaskFrame
      aside={aside}
      closeOnEscape
      exitHref={exitHref}
      footer={
        moment ? null : (
          <>
            <TaskActions>
              {phone.back !== -1 && <StepsBackButton onClick={back} />}
              {item.action}
              {!isLastHere && (
                <TaskMainButton
                  className={cn(isLastWide && "lg:hidden")}
                  onClick={() => move("next")}
                >
                  {t("Continue")}
                </TaskMainButton>
              )}
              {isLastWide && <WideOnly when={!isLastHere}>{finalAction}</WideOnly>}
              {ask}
            </TaskActions>
            {item.option}
            {isLastWide && <WideOnly when={!isLastHere}>{finalOptions}</WideOnly>}
          </>
        )
      }
      headerTitle={
        phone.total > 1 ? (
          <>
            {phone.total > 1 && (
              <StepDots
                className={cn(split && "lg:hidden")}
                current={phone.position}
                total={phone.total}
              />
            )}
            {split && wide.total > 1 && (
              <StepDots className="max-lg:hidden" current={wide.position} total={wide.total} />
            )}
          </>
        ) : null
      }
    >
      {moment ? (
        moment(closeMoment)
      ) : (
        <div className="flex flex-col gap-4" data-slot="steps-step" key={item.id} ref={stepRef}>
          <CelebrationScope play={!stepsLeft.includes(item.id)}>{item.content}</CelebrationScope>
        </div>
      )}
    </TaskFrame>
  );
}
