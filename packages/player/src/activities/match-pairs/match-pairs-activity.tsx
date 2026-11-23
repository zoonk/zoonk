"use client";

import { useSentenceSpace } from "@zoonk/learn/locale";
import { MatchEntry, type MatchEntryState } from "@zoonk/learn/match-entry";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { MatchBoard, MatchBoardCount } from "../../components/match-board";
import { NotQuiteLead } from "../../components/not-quite-lead";
import { usePlayerInteractionState } from "../../player-context";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { type MatchCard, arrangeMatchColumns, solvedRows } from "./match-pairs-columns";
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
type Miss = { explanation: string | null; left: string; right: string };

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
}): MatchEntryState {
  if (progress.matched.includes(card.id)) {
    return "right";
  }

  if (miss?.[side] === card.id) {
    return "wrong";
  }

  return selection[side] === card.id ? "selected" : "idle";
}

function MissNote({ explanation }: { explanation: string | null }) {
  const t = useExtracted();

  return (
    <div className="bg-destructive/10 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug">
      <CircleX aria-hidden="true" className="text-destructive-text mt-0.5 size-4 shrink-0" />
      <p>
        <NotQuiteLead />{" "}
        {explanation ? <LessonRichText text={explanation} /> : t("Those two don't go together.")}
      </p>
    </div>
  );
}

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
  const space = useSentenceSpace();
  const spoken = useSpokenText();
  const interactionState = usePlayerInteractionState();
  const [announcement, setAnnouncement] = useState("");
  const pairs = expectedInteraction(expected, "assignment")?.pairs ?? null;
  const isComplete = progress.matched.length === pairIds.length;

  function tryPair(leftCard: MatchCard, rightCard: MatchCard) {
    const next = recordTry(progress, { left: leftCard, right: rightCard });
    const leftText = spoken.inline(leftCard.text);
    const rightText = spoken.inline(rightCard.text);
    setProgress(next);
    setSelection(NO_SELECTION);
    onAnswerChange(matchAnswer(pairIds, next));

    if (isMatch(leftCard, rightCard)) {
      setMiss(null);

      setAnnouncement(
        t(
          "Matched {left} with {right}. {matched, plural, one {# of {total} pairs matched.} other {# of {total} pairs matched.}}",
          {
            left: leftText,
            matched: next.matched.length,
            right: rightText,
            total: String(pairIds.length),
          },
        ),
      );

      return;
    }

    const explanation = rightCard.why ?? leftCard.why;

    setMiss({ explanation, left: leftCard.id, right: rightCard.id });

    setAnnouncement(
      [
        t("{left} and {right} don't go together.", { left: leftText, right: rightText }),
        explanation && spoken.inline(explanation),
      ]
        .filter(Boolean)
        .join(space),
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

  function cardLabel(card: MatchCard, state: MatchEntryState): string {
    const text = spoken.inline(card.text);

    if (state === "right") {
      return t("{text}, matched", { text });
    }

    return text;
  }

  const stateOf = (side: Side, card: MatchCard) =>
    cardState({ card, miss, progress, selection, side });

  useNumberKeys({
    count: left.length + right.length,
    enabled: !isChecked && !isComplete && interactionState !== "paused",
    onPick: (index) => {
      const side: Side = index < left.length ? "left" : "right";
      const card = side === "left" ? left[index] : right[index - left.length];

      if (!card || stateOf(side, card) === "right") {
        return false;
      }

      pick(side, card);
    },
  });

  function cardButton(side: Side, card: MatchCard, index: number) {
    const state = stateOf(side, card);

    return (
      <MatchEntry
        className={state === "idle" ? "bg-background" : undefined}
        disabled={isChecked}
        index={side === "left" ? index : left.length + index}
        label={cardLabel(card, state)}
        onClick={() => pick(side, card)}
        pair={left.findIndex((other) => other.id === card.id)}
        state={state}
      >
        <LessonRichText text={card.text} />
      </MatchEntry>
    );
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <MatchBoardCount matched={progress.matched.length} total={pairIds.length} />

      <MatchBoard
        label={t("Cards to match")}
        left={left}
        renderItem={cardButton}
        right={right}
        solvedRows={isComplete ? solvedRows({ left, right }) : undefined}
      />

      {miss && <MissNote explanation={miss.explanation} />}

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
          "Two columns of cards. Pick a card on the left and one on the right to match them. {matched, plural, one {# of {total} pairs matched.} other {# of {total} pairs matched.}}",
          { matched: progress.matched.length, total: String(pairIds.length) },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
