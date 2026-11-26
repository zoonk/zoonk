"use client";

import { MatchBoard } from "@zoonk/learn/match-board";
import { MatchEntry } from "@zoonk/learn/match-entry";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { type MatchTry, useMatchBoard } from "@zoonk/learn/use-match-board";
import { CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { NotQuiteLead } from "../../components/not-quite-lead";
import { useCheckWhenAnswered } from "../../lesson/use-check-when-answered";
import { usePlayerInteractionState } from "../../player-context";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { arrangeMatchColumns } from "./match-pairs-columns";
import { boardFromAnswer, matchAnswer } from "./match-pairs-progress";

type MatchPairsProps = ActivityRendererProps<"matchPairs">;

/** Why a wrong try was wrong, when its card says; the try's own cue already says it was wrong. */
function MissNote({ explanation }: { explanation: string }) {
  return (
    <div className="bg-destructive/10 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug">
      <CircleX aria-hidden="true" className="text-destructive-text mt-0.5 size-4 shrink-0" />
      <p>
        <NotQuiteLead /> <LessonRichText text={explanation} />
      </p>
    </div>
  );
}

export function MatchPairsActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: MatchPairsProps) {
  const t = useExtracted();
  const columns = arrangeMatchColumns(content.fields);
  const { left, right } = columns;
  const isChecked = phase === "checked";
  const spoken = useSpokenText();
  const interactionState = usePlayerInteractionState();
  const checkWhenAnswered = useCheckWhenAnswered(answer !== null);
  const cardsOf = (side: "left" | "right") => (side === "left" ? left : right);

  const whyOf = ({ left: leftIndex, right: rightIndex }: MatchTry) =>
    right[rightIndex]?.why ?? left[leftIndex]?.why ?? null;

  const board = useMatchBoard({
    disabled: isChecked,
    explainMiss: (attempt) => {
      const why = whyOf(attempt);
      return why && spoken.inline(why);
    },
    finished: boardFromAnswer(columns, answer),
    isPair: (attempt) => left[attempt.left]?.id === right[attempt.right]?.id,
    keys: interactionState !== "paused",
    leftCount: left.length,
    onComplete: ({ misses }) => {
      checkWhenAnswered();
      onAnswerChange(matchAnswer(columns, misses));
    },
    rightCount: right.length,
    say: (side, index) => spoken.inline(cardsOf(side)[index]?.text ?? ""),
  });

  const missedWhy = board.missed && whyOf(board.missed);

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <MatchBoard
        label={t("Cards to match")}
        leftCount={left.length}
        renderCard={(side, index) => (
          <MatchEntry {...board.entry(side, index)}>
            <LessonRichText text={cardsOf(side)[index]?.text ?? ""} />
          </MatchEntry>
        )}
        rightCount={right.length}
        solved={board.solved}
      />

      {missedWhy && <MissNote explanation={missedWhy} />}

      <p aria-live="polite" className="sr-only">
        {board.announcement}
      </p>

      <ActivityTextAlternative>
        {t(
          "Two columns of cards. Pick a card on the left and one on the right to match them. {matched, plural, one {# of {total} pairs matched.} other {# of {total} pairs matched.}}",
          { matched: board.paired, total: String(left.length) },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
