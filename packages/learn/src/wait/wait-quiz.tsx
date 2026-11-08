"use client";

import { type WarmUpSurface } from "@zoonk/core/analytics/events";
import { type WarmUpCard as Card, type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { type AnswerOptionResult } from "../_components/answer-tone";
import { PageEyebrow } from "../_components/page";
import { VerdictLabel } from "../_components/verdict-label";
import { tabStorage } from "../_utils/device-storage";
import { isFocusLost } from "../_utils/is-focus-lost";
import { useLearnAnalytics } from "../learn-context";
import { useOnboardingClock } from "../onboarding/onboarding-clock";
import { QUESTION_TEXT_CLASS } from "../questions/item-text";

type Dealt = { pickedId: string | null; position: number };

const POSITION_KEY = "zoonk:warm-up:";

/** The next card the learner hasn't guessed in this tab, so another wait goes on from there. */
function readPosition(deckId: string): number {
  const saved = Number(tabStorage.get(`${POSITION_KEY}${deckId}`));
  return Number.isInteger(saved) && saved > 0 ? saved : 0;
}

export type WaitQuizState = {
  card: Card;
  hasNext: boolean;
  next: () => void;
  pick: (optionId: string) => void;
  pickedId: string | null;
  /** The card is on screen: counted once per deck, however often the learner switches views. */
  shown: () => void;
};

export type WaitQuizRefs = {
  /** The bar's way to the next card, where focus goes after a guess when the bar shows it. */
  nextRef: RefObject<HTMLButtonElement | null>;
  questionRef: RefObject<HTMLHeadingElement | null>;
};

/**
 * The card being played, kept by the wait screen so its other view and its bar act on the same one.
 * Null while there's no card: no deck coming, or every card was guessed in this tab. Undefined while
 * a deck is on its way, or known but its card isn't yet: the server can't know the tab's place.
 */
export function useWaitQuiz({
  coming,
  deck,
  goalId,
  onGuess,
  refs,
  surface,
}: {
  coming: boolean;
  deck: WarmUpDeck | null;
  goalId?: string | null;
  onGuess: () => void;
  refs: WaitQuizRefs;
  surface: WarmUpSurface;
}): WaitQuizState | null | undefined {
  const { track } = useLearnAnalytics();
  const clock = useOnboardingClock();
  const eventGoalId = goalId ?? clock?.goalId;
  const moved = useRef(false);
  const shownDeckId = useRef<string | null>(null);
  const mounted = useIsMounted();
  const [dealt, setDealt] = useState<Dealt | null>(null);
  const stored = deck && mounted ? { pickedId: null, position: readPosition(deck.id) } : null;
  const shown = deck && (dealt ?? stored);
  const card = shown ? deck.cards[shown.position] : undefined;
  const cardCount = deck?.cards.length ?? 0;

  // Focus follows the learner: to the way to the next card after a guess (the question when
  // there's none), and to the new question after it.
  useEffect(() => {
    if (!moved.current) {
      return;
    }

    moved.current = false;
    (refs.nextRef.current ?? refs.questionRef.current)?.focus();
  });

  if (!deck) {
    return coming ? undefined : null;
  }

  if (!shown) {
    return undefined;
  }

  if (!card) {
    return null;
  }

  const pick = (optionId: string) => {
    const option = card.options.find((candidate) => candidate.id === optionId);

    if (shown.pickedId !== null || !option) {
      return;
    }

    moved.current = true;
    setDealt({ pickedId: optionId, position: shown.position });
    tabStorage.set(`${POSITION_KEY}${deck.id}`, String(shown.position + 1));
    onGuess();

    track({
      name: "Warm-Up Answered",
      properties: {
        card_id: card.id,
        correct: option.correct,
        position: shown.position + 1,
        surface,
      },
    });
  };

  const next = () => {
    moved.current = true;
    setDealt({ pickedId: null, position: shown.position + 1 });
  };

  const markShown = () => {
    if (shownDeckId.current === deck.id) {
      return;
    }

    shownDeckId.current = deck.id;

    track({
      name: "Warm-Up Shown",
      properties: {
        at: Date.now(),
        card_count: cardCount,
        deck_id: deck.id,
        goal_id: eventGoalId,
        surface,
      },
    });
  };

  return {
    card,
    hasNext: shown.position + 1 < cardCount,
    next,
    pick,
    pickedId: shown.pickedId,
    shown: markShown,
  };
}

/**
 * Answers are radios, and Enter on a radio goes on to the screen's main button (it submits a
 * player's picked answer). Here a press picks the answer, so Enter on one stays with it.
 */
function keepEnter(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.stopPropagation();
  }
}

function getResult({
  answered,
  correct,
  picked,
}: {
  answered: boolean;
  correct: boolean;
  picked: boolean;
}): AnswerOptionResult | null {
  if (!answered) {
    return null;
  }

  if (correct) {
    return "right";
  }

  return picked ? "guess" : null;
}

function QuizReveal({ card, pickedId }: { card: Card; pickedId: string }) {
  const right = card.options.some((option) => option.id === pickedId && option.correct);

  return (
    <div className="flex flex-col gap-1.5">
      <VerdictLabel verdict={right ? "guessRight" : "guess"} />
      <p className="text-[0.9375rem] leading-normal text-pretty">{card.reveal}</p>
    </div>
  );
}

function QuizEyebrow() {
  const t = useExtracted();

  return (
    <PageEyebrow>
      {t({
        description:
          "The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it.",
        message: "Quiz while you wait",
      })}
    </PageEyebrow>
  );
}

const OPTION_COUNT = 3;

/** The card's shapes, until the browser knows which card this tab is on. */
export function WaitQuizSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <QuizEyebrow />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>

      <div className="flex flex-col gap-2.5">
        {Array.from({ length: OPTION_COUNT }, (_, index) => (
          <Skeleton className="rounded-option h-12.5 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * A guess while the learner waits, a side game apart from their course. Once what they wait for is
 * ready (`holding`), they can still answer this card and read its reveal, but no new card is dealt.
 */
export function WaitQuizCard({
  holding,
  questionRef,
  quiz,
}: {
  holding: boolean;
  questionRef: WaitQuizRefs["questionRef"];
  quiz: WaitQuizState;
}) {
  const t = useExtracted();
  const questionId = useId();
  const { card, pick, pickedId } = quiz;
  const answered = pickedId !== null;
  const markShown = useEffectEvent(quiz.shown);

  // Drawn here, the card is on screen once the tab is.
  useEffect(() => {
    const show = () => {
      if (document.visibilityState === "visible") {
        markShown();
      }
    };

    show();
    document.addEventListener("visibilitychange", show);
    return () => document.removeEventListener("visibilitychange", show);
  }, []);

  // A hold takes the way to the next card away, so focus on it stays in the card; a main button
  // that takes lost focus first (the session's Start) keeps it.
  useEffect(() => {
    if (holding && isFocusLost(document.activeElement)) {
      questionRef.current?.focus({ preventScroll: true });
    }
  }, [holding, questionRef]);

  useNumberKeys({
    count: card.options.length,
    enabled: !answered,
    onPick: (index) => {
      const option = card.options[index];

      if (!option) {
        return false;
      }

      pick(option.id);
    },
  });

  return (
    <section aria-labelledby={questionId} className="flex flex-col gap-5" data-slot="wait-quiz">
      <div className="flex flex-col gap-2">
        <QuizEyebrow />

        <h2
          className={cn(QUESTION_TEXT_CLASS, "text-pretty outline-none")}
          id={questionId}
          ref={questionRef}
          tabIndex={-1}
        >
          {card.question}
        </h2>
      </div>

      <AnswerOptionGroup aria-label={undefined} aria-labelledby={questionId}>
        {card.options.map((option, index) => {
          const picked = option.id === pickedId;

          return (
            <AnswerOption
              aria-keyshortcuts={String(index + 1)}
              disabled={answered}
              guessed
              key={option.id}
              marker={index + 1}
              onClick={() => pick(option.id)}
              onKeyDown={keepEnter}
              picked={picked}
              result={getResult({ answered, correct: option.correct, picked })}
            >
              {option.text}
            </AnswerOption>
          );
        })}
      </AnswerOptionGroup>

      {/* The live region stays rendered, so the reveal is announced as it lands in it. */}
      <div>
        {pickedId === null && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Just for fun. Your answers don't count.")}
          </p>
        )}

        <div aria-live="polite">
          {pickedId !== null && <QuizReveal card={card} pickedId={pickedId} />}
        </div>
      </div>
    </section>
  );
}
