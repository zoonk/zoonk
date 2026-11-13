"use client";

import { useSentenceSpace } from "@zoonk/learn/locale";
import { MatchEntry, type MatchEntryState } from "@zoonk/learn/match-entry";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { MatchBoard } from "../../components/match-board";
import { NotQuiteLead } from "../../components/not-quite-lead";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { usePlayerInteractionState } from "../../player-context";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import {
  type MatchCard,
  arrangeMatchColumns,
  explainMismatch,
  solvedRows,
} from "./match-pairs-columns";
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
const SETTLED = new Set<MatchEntryState>(["none", "right"]);

function cardState({
  card,
  isComplete,
  miss,
  progress,
  selection,
  side,
}: {
  card: MatchCard;
  isComplete: boolean;
  miss: Miss | null;
  progress: MatchProgress;
  selection: Selection;
  side: Side;
}): MatchEntryState {
  if (!card.isTrap && progress.matched.includes(card.id)) {
    return "right";
  }

  if (card.isTrap && (isComplete || progress.traps.includes(card.id))) {
    return "none";
  }

  if (miss?.[side] === card.id) {
    return "wrong";
  }

  return selection[side] === card.id ? "selected" : "idle";
}

function MatchCount({ matched, total, traps }: { matched: number; total: number; traps: number }) {
  const t = useExtracted();

  return (
    <ActivityCanvasLabel className="tabular-nums">
      {t("{matched, plural, one {# of {total} pairs matched} other {# of {total} pairs matched}}", {
        matched,
        total: String(total),
      })}

      {traps > 0 && (
        <>
          {" · "}
          {t("{count, plural, one {# card has no match} other {# cards have no match}}", {
            count: traps,
          })}
        </>
      )}
    </ActivityCanvasLabel>
  );
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
  const trapCount = fields.distractors.length;
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

    const { reason, trap } = explainMismatch({ left: leftCard, right: rightCard });
    const trapNote = trap ? t("“{card}” has no match.", { card: trap.text }) : null;
    const explanation = [trapNote, reason].filter(Boolean).join(space) || null;

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

    return state === "none" ? t("{text}, no match", { text }) : text;
  }

  const stateOf = (side: Side, card: MatchCard) =>
    cardState({ card, isComplete, miss, progress, selection, side });

  useNumberKeys({
    count: left.length + right.length,
    enabled: !isChecked && !isComplete && interactionState !== "paused",
    onPick: (index) => {
      const side: Side = index < left.length ? "left" : "right";
      const card = side === "left" ? left[index] : right[index - left.length];

      if (!card || SETTLED.has(stateOf(side, card))) {
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
        pair={left.findIndex((other) => !other.isTrap && other.id === card.id)}
        state={state}
      >
        <LessonRichText text={card.text} />
      </MatchEntry>
    );
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <MatchCount matched={progress.matched.length} total={pairIds.length} traps={trapCount} />

      <MatchBoard
        className="text-sm sm:text-base"
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
          "Two columns of cards. Pick a card on the left and one on the right to match them. {count, plural, =0 {} one {# card has no match.} other {# cards have no match.}} {matched, plural, one {# of {total} pairs matched.} other {# of {total} pairs matched.}}",
          { count: trapCount, matched: progress.matched.length, total: String(pairIds.length) },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
