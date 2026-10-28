"use client";

import { Button } from "@zoonk/ui/components/button";
import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { getStepMoves } from "../_utils/step-moves";
import { CeremonyClosingContext } from "../ceremonies/ceremony-closing";
import { TaskFrame, type TaskFrameAside, TaskMainButton } from "../shell/task-frame";
import { STEP_TITLE_SLOT } from "./step-card";
import { StepDots } from "./step-dots";
import { useTaskAsideShown } from "./task-header";
import { TASK_BACK_ACTION_CLASS, TaskActions } from "./task-layout";

export type StepsItem = {
  action?: React.ReactNode;
  beside?: boolean;
  content: React.ReactNode;
  id: string;
  option?: React.ReactNode;
  moment?: (close: () => void) => React.ReactNode;
};

export function focusStepTitle(container: HTMLElement | null) {
  container
    ?.querySelector<HTMLElement>(`[data-slot="${STEP_TITLE_SLOT}"]`)
    ?.focus({ preventScroll: true });
}

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

function WideOnly({ children, when }: { children: React.ReactNode; when: boolean }) {
  return when ? <div className="contents max-lg:hidden">{children}</div> : children;
}

function useStepMoment(item: StepsItem | undefined) {
  const [shown, setShown] = useState<string[]>([]);
  const [closing, setClosing] = useState<string | null>(null);

  if (!item?.moment || shown.includes(item.id)) {
    return { moment: null, shown, showsStep: true };
  }

  const { id } = item;

  return {
    moment: (
      <CeremonyClosingContext value={() => setClosing(id)}>
        {item.moment(() => setShown((ids) => [...ids, id]))}
      </CeremonyClosingContext>
    ),
    shown,
    showsStep: closing === id,
  };
}

export function Steps({
  aside,
  ask,
  exitHref,
  finalAction,
  finalOptions,
  items,
}: {
  aside?: TaskFrameAside | null;
  ask?: React.ReactNode;
  exitHref: string;
  finalAction: React.ReactNode;
  finalOptions?: React.ReactNode;
  items: StepsItem[];
}) {
  const t = useExtracted();
  const asideShown = useTaskAsideShown();
  const [index, setIndex] = useState(0);
  const [stepsLeft, setStepsLeft] = useState<string[]>([]);
  const stepRef = useRef<HTMLDivElement>(null);
  const focusedIndex = useRef(0);
  const reached = Math.min(index, items.length - 1);

  const current =
    asideShown && items[reached]?.beside
      ? Math.max(
          items.findLastIndex((step, position) => position < reached && !step.beside),
          0,
        )
      : reached;

  const item = items[current];
  const { moment, showsStep, shown: momentsShown } = useStepMoment(item);
  const phone = getStepMoves({ current, steps: items, wide: false });
  const wide = getStepMoves({ current, steps: items, wide: true });
  // The server can't know the width, so each arrangement's dots and last-step actions are drawn and
  // CSS shows one (`lg:hidden`, `max-lg:hidden`).
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

  useEffect(() => {
    if (focusedIndex.current === current) {
      return;
    }

    focusedIndex.current = current;
    focusStepTitle(stepRef.current);
  }, [current]);

  useEffect(() => {
    if (momentsShown.length > 0) {
      focusStepTitle(stepRef.current);
    }
  }, [momentsShown]);

  if (!item) {
    return null;
  }

  return (
    <TaskFrame
      aside={aside}
      closeOnEscape
      exitHref={exitHref}
      footer={
        showsStep ? (
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
        ) : null
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
      {showsStep && (
        <div className="flex flex-col gap-4" data-slot="steps-step" key={item.id} ref={stepRef}>
          <CelebrationScope play={!stepsLeft.includes(item.id)}>{item.content}</CelebrationScope>
        </div>
      )}
      {moment}
    </TaskFrame>
  );
}
