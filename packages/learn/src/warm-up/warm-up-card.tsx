"use client";

import { type WarmUpSurface } from "@zoonk/core/analytics/events";
import { type WarmUpCard as Card, type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { Button } from "@zoonk/ui/components/button";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useEnterKey, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type Ref, useEffect, useId, useRef, useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { type AnswerOptionResult } from "../_components/answer-tone";
import { GuessHint } from "../_components/guess-hint";
import { VerdictLabel } from "../_components/verdict-label";
import { tabStorage } from "../_utils/device-storage";
import { useLearnAnalytics } from "../learn-context";

type Dealt = { pickedId: string | null; position: number };

const POSITION_KEY = "zoonk:warm-up:";

/** The next card the learner hasn't guessed in this tab, so another wait goes on from there. */
function readPosition(deckId: string): number {
  const saved = Number(tabStorage.get(`${POSITION_KEY}${deckId}`));
  return Number.isInteger(saved) && saved > 0 ? saved : 0;
}

/** The server can't know the tab's place, so the card shows once the page is in the browser. */
function useStoredPosition(deckId: string): number | null {
  return useIsMounted() ? readPosition(deckId) : null;
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

function WarmUpReveal({ card, pickedId }: { card: Card; pickedId: string }) {
  const right = card.options.some((option) => option.id === pickedId && option.correct);

  return (
    <div className="flex flex-col gap-1.5">
      <VerdictLabel verdict={right ? "guessRight" : "guess"} />
      <p className="text-[0.9375rem] leading-normal text-pretty">{card.reveal}</p>
    </div>
  );
}

function NextGuess({
  hasNext,
  onNext,
  ref,
}: {
  hasNext: boolean;
  onNext: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const t = useExtracted();

  useEnterKey(onNext, { enabled: hasNext });

  if (!hasNext) {
    return <p className="text-muted-foreground self-end text-sm">{t("That's all for now.")}</p>;
  }

  return (
    <Button
      className="hit-area relative self-end"
      onClick={onNext}
      ref={ref}
      size="sm"
      variant="outline"
    >
      {t("Next guess")}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </Button>
  );
}

/**
 * A quick guess while the learner waits. Once what they wait for is ready (`holding`), they can
 * still answer this card and read its reveal, but no new card is dealt.
 */
export function WarmUpCard({
  deck,
  holding,
  onGuess,
  surface,
}: {
  deck: WarmUpDeck;
  holding: boolean;
  onGuess: () => void;
  surface: WarmUpSurface;
}) {
  const t = useExtracted();
  const { track } = useLearnAnalytics();
  const questionId = useId();
  const questionRef = useRef<HTMLParagraphElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  const stored = useStoredPosition(deck.id);
  const [dealt, setDealt] = useState<Dealt | null>(null);
  const shown = dealt ?? (stored === null ? null : { pickedId: null, position: stored });
  const card = shown ? deck.cards[shown.position] : undefined;
  const pickedId = shown?.pickedId ?? null;
  const answered = pickedId !== null;
  const hasCard = card !== undefined;

  useEffect(() => {
    if (hasCard) {
      track({ name: "Warm-Up Shown", properties: { card_count: deck.cards.length, surface } });
    }
  }, [deck.cards.length, hasCard, surface, track]);

  const pick = (optionId: string) => {
    const option = card?.options.find((candidate) => candidate.id === optionId);

    if (!card || !shown || answered || !option) {
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

  // Focus follows the learner: to "Next guess" after a guess (the question when there's none), and
  // to the new question after it.
  useEffect(() => {
    if (!moved.current) {
      return;
    }

    moved.current = false;
    (nextRef.current ?? questionRef.current)?.focus();
  });

  useNumberKeys({
    count: card?.options.length ?? 0,
    enabled: hasCard && !answered,
    onPick: (index) => {
      const option = card?.options[index];

      if (!option) {
        return false;
      }

      pick(option.id);
    },
  });

  if (!card || !shown) {
    return null;
  }

  const next = () => {
    moved.current = true;
    setDealt({ pickedId: null, position: shown.position + 1 });
  };

  return (
    <section
      aria-labelledby={questionId}
      className="bg-card ring-border flex flex-col gap-3 rounded-xl p-4 ring-1 ring-inset"
      data-slot="warm-up-card"
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-[0.8125rem] font-medium [&_svg]:size-3.5">
        <SparklesIcon aria-hidden="true" />
        {t("Guess while you wait")}
      </p>

      <p
        className="text-[1.0625rem] leading-snug font-[560] tracking-[-0.012em] text-pretty outline-none"
        id={questionId}
        ref={questionRef}
        tabIndex={-1}
      >
        {card.question}
      </p>

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
        {pickedId === null && <GuessHint />}
        <div aria-live="polite">
          {pickedId !== null && <WarmUpReveal card={card} pickedId={pickedId} />}
        </div>
      </div>

      {answered && !holding && (
        <NextGuess hasNext={shown.position + 1 < deck.cards.length} onNext={next} ref={nextRef} />
      )}
    </section>
  );
}
