"use client";

import { Button } from "@zoonk/ui/components/button";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { ArrowLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { STEP_TITLE_SLOT } from "./step-card";
import { StepDots } from "./step-dots";

/** One thing to say, as its own card. Steps with nothing to say are left out by the caller. */
export type StepsItem = {
  content: React.ReactNode;
  id: string;
  /**
   * A full-screen moment over this step (a ceremony), shown once as the learner reaches it. It
   * calls `close` when it's over, and the step under it takes the focus.
   */
  moment?: (close: () => void) => React.ReactNode;
};

/** Moves focus to the step's title, so a screen reader reads each step as it comes. */
function focusTitle(container: HTMLElement | null) {
  container
    ?.querySelector<HTMLElement>(`[data-slot="${STEP_TITLE_SLOT}"]`)
    ?.focus({ preventScroll: true });
}

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useExtracted();

  return (
    <Button
      aria-keyshortcuts="ArrowLeft"
      aria-label={t("Back")}
      className="size-14 shrink-0"
      onClick={onClick}
      size="icon"
      variant="outline"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-5" />
    </Button>
  );
}

/**
 * A result told one thing at a time, full screen like a task: leave on the left (Escape too), dots
 * for where the learner is, one card in the middle, and Continue (Enter) under it, with Back beside
 * it (← too). The last step has the screen's own actions instead of Continue. On phones the
 * actions sit at the bottom; on wide screens the card and its actions stay together in the middle.
 */
export function Steps({
  exitHref,
  finalAction,
  finalOptions,
  headerEnd,
  items,
}: {
  exitHref: string;
  /** The last step's main action, in Continue's place; it binds its own Enter. */
  finalAction: React.ReactNode;
  /** Quiet options under the last step's main action. */
  finalOptions?: React.ReactNode;
  headerEnd?: React.ReactNode;
  items: StepsItem[];
}) {
  const t = useExtracted();
  const [index, setIndex] = useState(0);
  const [momentsShown, setMomentsShown] = useState<string[]>([]);
  const stepRef = useRef<HTMLDivElement>(null);
  const focusedIndex = useRef(0);
  const lastIndex = items.length - 1;
  const current = Math.min(index, lastIndex);
  const item = items[current];
  const isLast = current === lastIndex;

  const back = () => {
    if (current === 0) {
      return false;
    }

    setIndex(current - 1);
  };

  useKeyboardCallback("ArrowLeft", back, { mode: "none", screen: true });

  // A new step takes the focus, but the page's first one keeps it where the browser put it.
  useEffect(() => {
    if (focusedIndex.current === current) {
      return;
    }

    focusedIndex.current = current;
    focusTitle(stepRef.current);
  }, [current]);

  // Once a moment over the step closes, the step under it takes the focus.
  useEffect(() => {
    if (momentsShown.length > 0) {
      focusTitle(stepRef.current);
    }
  }, [momentsShown]);

  if (!item) {
    return null;
  }

  const showsMoment = item.moment && !momentsShown.includes(item.id);

  const closeMoment = () => setMomentsShown((shown) => [...shown, item.id]);

  return (
    <TaskFrame
      closeOnEscape
      exitHref={exitHref}
      footer={
        <>
          <div className="flex gap-2">
            {current > 0 && <BackButton onClick={() => setIndex(current - 1)} />}
            <div className="min-w-0 flex-1">
              {isLast ? (
                finalAction
              ) : (
                <TaskMainButton onClick={() => setIndex(current + 1)}>
                  {t("Continue")}
                </TaskMainButton>
              )}
            </div>
          </div>
          {isLast && finalOptions}
        </>
      }
      headerEnd={headerEnd}
      headerTitle={items.length > 1 ? <StepDots current={current} total={items.length} /> : null}
    >
      <div
        className="animate-in fade-in slide-in-from-bottom-3 flex flex-1 flex-col justify-center gap-4 duration-300 ease-out lg:flex-none"
        data-slot="steps-step"
        key={item.id}
        ref={stepRef}
      >
        {item.content}
      </div>

      {showsMoment && item.moment?.(closeMoment)}
    </TaskFrame>
  );
}
