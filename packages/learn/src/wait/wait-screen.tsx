"use client";

import { type WarmUpSurface } from "@zoonk/core/analytics/events";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { Button } from "@zoonk/ui/components/button";
import { useEnterKey, useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, type RefObject, createContext, use, useRef } from "react";
import { TASK_HEADER_ICON_CLASS } from "../_components/task-header";
import { type ReadyHoldControl } from "./use-ready-hold";
import { type WaitView, useWaitView } from "./use-wait-view";
import {
  WaitQuizCard,
  type WaitQuizRefs,
  WaitQuizSkeleton,
  type WaitQuizState,
  useWaitQuiz,
} from "./wait-quiz";

type WaitScreenValue = {
  /** The host shows the progress in its aside from 72rem, so there's nothing to switch there. */
  aside: boolean;
  /** Every Back's action while the learner has the progress open; null otherwise. */
  back: (() => void) | null;
  /** The column's content, whose first heading takes focus as the progress opens. */
  contentRef: RefObject<HTMLDivElement | null>;
  hold: ReadyHoldControl;
  nextRef: WaitQuizRefs["nextRef"];
  openProgress: () => void;
  playQuiz: () => void;
  questionRef: WaitQuizRefs["questionRef"];
  /** Undefined while the deck is known but its card isn't yet. */
  quiz: WaitQuizState | null | undefined;
  /** The ready action: moves on, taking back the history entry the progress pushed. */
  release: () => void;
  /** The bar's slot has something to offer of its own: the next card, or a way to the quiz. */
  slotShown: boolean;
  statusRef: RefObject<HTMLButtonElement | null>;
  /** The learner switched views, so the new one fades in; nothing fades on its own. */
  switched: boolean;
  view: WaitView;
};

const WaitScreenContext = createContext<WaitScreenValue | null>(null);

export function useWaitScreen(): WaitScreenValue {
  const value = use(WaitScreenContext);

  if (!value) {
    throw new Error("useWaitScreen needs a WaitScreen");
  }

  return value;
}

/** While the learner has the progress open, every Back returns to the quiz; null outside a wait. */
export function useWaitBack(): (() => void) | null {
  return use(WaitScreenContext)?.back ?? null;
}

/**
 * One wait screen for every wait: a quiz while the learner waits, and the work's progress one tap
 * away on its status strip. Every wait holds by the same rule (`hold`).
 */
export function WaitScreen({
  aside = false,
  children,
  deck,
  goalId,
  hold,
  surface,
}: {
  aside?: boolean;
  children: ReactNode;
  deck: WarmUpDeck | null;
  /** Outside onboarding, which knows its goal, the goal whose deck this is. */
  goalId?: string | null;
  hold: ReadyHoldControl;
  surface: WarmUpSurface;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const quiz = useWaitQuiz({
    deck,
    goalId,
    onGuess: hold.engage,
    refs: { nextRef, questionRef },
    surface,
  });

  const view = useWaitView({ hasQuiz: quiz !== null, hold, questionRef });
  const picked = typeof quiz?.pickedId === "string";
  const slotShown = Boolean(quiz) && (view.view === "progress" || picked);

  return (
    <WaitScreenContext value={{ ...view, aside, hold, nextRef, questionRef, quiz, slotShown }}>
      {children}
    </WaitScreenContext>
  );
}

/** The status strip and the quiz, or the progress, in the screen's column. */
export function WaitContent({ progress, status }: { progress: ReactNode; status: ReactNode }) {
  const { contentRef, hold, questionRef, quiz, switched, view } = useWaitScreen();

  return (
    <div
      className="duration-quick flex flex-col gap-6 transition-opacity ease-out outline-none data-switched:starting:opacity-0"
      data-slot="wait-content"
      data-switched={switched ? "" : undefined}
      key={view}
      ref={contentRef}
      // Focus lands here as the progress opens when it has no heading of its own.
      tabIndex={-1}
    >
      {view === "quiz" ? (
        <>
          {status}
          {quiz ? (
            <WaitQuizCard holding={hold.status === "hold"} questionRef={questionRef} quiz={quiz} />
          ) : (
            <WaitQuizSkeleton />
          )}
        </>
      ) : (
        progress
      )}
    </div>
  );
}

/** The progress in the host's aside, only while the quiz has the column. */
export function WaitAside({ children }: { children: ReactNode }) {
  const { aside, view } = useWaitScreen();

  if (!aside || view !== "quiz") {
    return null;
  }

  return (
    <WaitPlaceContext value="aside">
      <div className="border-border flex flex-col gap-6 border-b pb-8" data-slot="wait-aside">
        {children}
      </div>
    </WaitPlaceContext>
  );
}

type WaitPlace = "aside" | "page";

const WaitPlaceContext = createContext<WaitPlace>("page");

export function useWaitPlace(): WaitPlace {
  return use(WaitPlaceContext);
}

const SLOT_BUTTON_CLASS = "w-full lg:w-auto lg:min-w-40";

function useBackToQuizText(): string {
  const t = useExtracted();

  return t({
    description:
      "The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it.",
    message: "Back to the quiz",
  });
}

/**
 * The bar's one slot: what's ready when something is (`children`), otherwise the quiz's next card,
 * the way back to it, or the quiz once a card arrived.
 */
export function WaitSlot({
  children,
  enterKey = true,
}: {
  children?: ReactNode;
  /** False when Enter already runs another button on the screen. */
  enterKey?: boolean;
}) {
  const t = useExtracted();
  const backToQuiz = useBackToQuizText();
  const { back, nextRef, playQuiz, quiz, view } = useWaitScreen();
  const answered = typeof quiz?.pickedId === "string";
  const hasNext = quiz ? quiz.hasNext : false;
  const nextShown = !children && view === "quiz" && answered && hasNext;

  useEnterKey(() => quiz?.next(), { enabled: nextShown && enterKey });

  if (children) {
    return children;
  }

  if (view === "progress" && quiz) {
    return (
      <Button className={SLOT_BUTTON_CLASS} onClick={back ?? playQuiz} size="lg" variant="outline">
        {back
          ? backToQuiz
          : t({
              description:
                "The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it.",
              message: "Play a quiz while you wait",
            })}
      </Button>
    );
  }

  if (view !== "quiz" || !quiz || !answered) {
    return null;
  }

  if (!quiz.hasNext) {
    return (
      <p className="text-muted-foreground text-center text-sm lg:text-right">
        {t("That's all for now.")}
      </p>
    );
  }

  return (
    <Button
      className={SLOT_BUTTON_CLASS}
      onClick={quiz.next}
      ref={nextRef}
      size="lg"
      variant="outline"
    >
      {t("Next guess")}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </Button>
  );
}

/** A task's top bar: its way out (`children`), or, while the progress is open, the way back to the quiz. */
export function WaitTopBarBack({ children }: { children: ReactNode }) {
  const label = useBackToQuizText();
  const back = useWaitBack();
  const ref = useEscapeClick<HTMLButtonElement>({ enabled: back !== null });

  if (!back) {
    return children;
  }

  return (
    <Button
      aria-keyshortcuts="Escape"
      aria-label={label}
      className={cn("shrink-0", TASK_HEADER_ICON_CLASS.start)}
      onClick={back}
      ref={ref}
      size="icon"
      variant="ghost"
    >
      <ChevronLeftIcon aria-hidden="true" />
    </Button>
  );
}
