"use client";

import { FeedbackNote } from "@zoonk/learn/feedback-panel";
import { useExtracted } from "next-intl";
import { createContext } from "react";

/**
 * `savePending`: the server hasn't said yet whether it saved this miss, so the note keeps the saved
 * line's room, unseen, and its arrival moves nothing.
 */
export type LessonResultNext = { savePending: boolean; savedMistake: boolean; willReturn: boolean };

/** What a lesson adds to the feedback card of a step that draws its own (an activity). */
export const OwnResultNotesContext = createContext<
  (LessonResultNext & { hyperdriveStreak: number | null }) | null
>(null);

function ResultNextText({
  savedMistake,
  willReturn,
}: Pick<LessonResultNext, "savedMistake" | "willReturn">) {
  const t = useExtracted();

  if (savedMistake && willReturn) {
    return t({
      description:
        "“your mistakes” is the learner's Mistakes notebook, in lowercase as in the English.",
      message: "Saved to your mistakes · back at the end of this lesson",
    });
  }

  if (savedMistake) {
    return t({
      description:
        "“your mistakes” is the learner's Mistakes notebook, in lowercase as in the English.",
      message: "Saved to your mistakes",
    });
  }

  return t("This question comes back at the end of the lesson");
}

export function HyperdriveStreak({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <span data-slot="lesson-hyperdrive">
      {t("{count} right in a row", { count: String(count) })}
    </span>
  );
}

function ResultNext({ savePending, savedMistake, willReturn }: LessonResultNext) {
  if (savePending) {
    return (
      <span className="invisible">
        <ResultNextText savedMistake willReturn={willReturn} />
      </span>
    );
  }

  return <ResultNextText savedMistake={savedMistake} willReturn={willReturn} />;
}

function hasResultNext({ savePending, savedMistake, willReturn }: LessonResultNext): boolean {
  return savePending || savedMistake || willReturn;
}

export function LessonResultNote(next: LessonResultNext) {
  if (!hasResultNext(next)) {
    return null;
  }

  return (
    <FeedbackNote>
      <ResultNext {...next} />
    </FeedbackNote>
  );
}

export function LessonResultNotes({
  hyperdriveStreak,
  ...next
}: LessonResultNext & { hyperdriveStreak: number | null }) {
  const hasNext = hasResultNext(next);

  if (hyperdriveStreak === null && !hasNext) {
    return null;
  }

  return (
    <FeedbackNote data-slot="lesson-result-notes">
      {hyperdriveStreak !== null && <HyperdriveStreak count={hyperdriveStreak} />}
      {hyperdriveStreak !== null && hasNext && !next.savePending && " · "}
      {hasNext && <ResultNext {...next} />}
    </FeedbackNote>
  );
}
