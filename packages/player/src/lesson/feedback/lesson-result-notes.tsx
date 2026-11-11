"use client";

import { FeedbackNote } from "@zoonk/learn/feedback-panel";
import { useExtracted } from "next-intl";

export type LessonResultNext = { savedMistake: boolean; willReturn: boolean };

function ResultNextText({ savedMistake, willReturn }: LessonResultNext) {
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

export function LessonResultNote({ savedMistake, willReturn }: LessonResultNext) {
  if (!savedMistake && !willReturn) {
    return null;
  }

  return (
    <FeedbackNote>
      <ResultNextText savedMistake={savedMistake} willReturn={willReturn} />
    </FeedbackNote>
  );
}

export function LessonResultNotes({
  hyperdriveStreak,
  savedMistake,
  willReturn,
}: LessonResultNext & { hyperdriveStreak: number | null }) {
  const hasNext = savedMistake || willReturn;

  if (hyperdriveStreak === null && !hasNext) {
    return null;
  }

  return (
    <FeedbackNote data-slot="lesson-result-notes">
      {hyperdriveStreak !== null && <HyperdriveStreak count={hyperdriveStreak} />}
      {hyperdriveStreak !== null && hasNext && " · "}
      {hasNext && <ResultNextText savedMistake={savedMistake} willReturn={willReturn} />}
    </FeedbackNote>
  );
}
