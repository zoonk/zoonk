"use client";

import { CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { type MatchCardState, MatchPairsCard } from "./match-pairs-card";
import { type MatchCard, arrangeMatchColumns, mismatchReason } from "./match-pairs-columns";
import {
  type MatchProgress,
  isMatch,
  matchAnswer,
  progressFromAnswer,
  recordTry,
} from "./match-pairs-progress";
import { MatchPairsResults } from "./match-pairs-results";

type MatchPairsProps = ActivityRendererProps<"matchPairs">;
type Side = "left" | "right";
type Selection = Record<Side, string | null>;
type Miss = { left: string; reason: string | null; right: string };

const NO_SELECTION: Selection = { left: null, right: null };

function cardState({
  card,
  miss,
  progress,
  selection,
  side,
}: {
  card: MatchCard;
  miss: Miss | null;
  progress: MatchProgress;
  selection: Selection;
  side: Side;
}): MatchCardState {
  if (!card.isTrap && progress.matched.includes(card.id)) {
    return "matched";
  }

  if (miss?.[side] === card.id) {
    return "missed";
  }

  return selection[side] === card.id ? "selected" : "idle";
}

/**
 * Pair cards that belong together, with look-alike traps. Pick one card on each side: a match
 * locks in, a miss says why the two don't go together. Every pair must be matched before the
 * check, which grades each pair's first try.
 */
export function MatchPairsActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: MatchPairsProps) {
  const t = useExtracted();
  const { fields } = content;
  const { left, right } = arrangeMatchColumns(fields);
  const pairIds = fields.pairs.map((pair) => pair.id);
  const isChecked = phase === "checked";
  const [progress, setProgress] = useState<MatchProgress>(() => progressFromAnswer(answer));
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [miss, setMiss] = useState<Miss | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pairs = expectedInteraction(expected, "assignment")?.pairs ?? null;

  function tryPair(leftCard: MatchCard, rightCard: MatchCard) {
    const next = recordTry(progress, { left: leftCard, right: rightCard });
    setProgress(next);
    setSelection(NO_SELECTION);
    onAnswerChange(matchAnswer(pairIds, next));

    if (isMatch(leftCard, rightCard)) {
      setMiss(null);

      setAnnouncement(
        t("Matched {left} with {right}. {matched} of {total} pairs matched.", {
          left: leftCard.text,
          matched: String(next.matched.length),
          right: rightCard.text,
          total: String(pairIds.length),
        }),
      );

      return;
    }

    const reason = mismatchReason({
      left: leftCard,
      pairs: left.filter((card) => !card.isTrap),
      right: rightCard,
    });

    setMiss({ left: leftCard.id, reason, right: rightCard.id });

    setAnnouncement(
      [
        t("{left} and {right} don't go together.", { left: leftCard.text, right: rightCard.text }),
        reason,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function pick(side: Side, card: MatchCard) {
    const next = { ...selection, [side]: selection[side] === card.id ? null : card.id };
    const leftCard = left.find((item) => item.id === next.left);
    const rightCard = right.find((item) => item.id === next.right);

    setMiss(null);

    if (leftCard && rightCard) {
      tryPair(leftCard, rightCard);
      return;
    }

    setSelection(next);
  }

  function column(side: Side, cards: readonly MatchCard[]) {
    return (
      <div className="flex flex-col gap-2">
        {cards.map((card) => {
          const state = cardState({ card, miss, progress, selection, side });

          return (
            <MatchPairsCard
              isDisabled={isChecked || state === "matched"}
              key={card.id}
              label={state === "matched" ? t("{text}, matched", { text: card.text }) : card.text}
              onPick={() => pick(side, card)}
              state={state}
              text={card.text}
            />
          );
        })}
      </div>
    );
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <div
        aria-label={t("Cards to match")}
        className="grid grid-cols-2 items-start gap-2.5"
        role="group"
      >
        {column("left", left)}
        {column("right", right)}
      </div>

      {miss && (
        <div className="bg-destructive/10 flex gap-2.5 rounded-2xl px-3.5 py-3 text-sm leading-snug">
          <CircleX aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
          <p>
            <span className="text-destructive font-semibold">{t("Not quite:")}</span>{" "}
            {miss.reason ? (
              <LessonRichText text={miss.reason} />
            ) : (
              t("Those two don't go together.")
            )}
          </p>
        </div>
      )}

      <ActivityCanvasLabel className="text-center tabular-nums">
        {t("{matched} of {total} pairs matched", {
          matched: String(progress.matched.length),
          total: String(pairIds.length),
        })}
      </ActivityCanvasLabel>

      {isChecked && pairs && (
        <MatchPairsResults
          cards={{ left, right }}
          expected={pairs}
          firstTries={progress.firstTries}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ActivityTextAlternative>
        {t(
          "Two columns of cards. Pick a card on the left and one on the right to match them. Some cards are look-alike traps with no match. {matched} of {total} pairs matched.",
          { matched: String(progress.matched.length), total: String(pairIds.length) },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
