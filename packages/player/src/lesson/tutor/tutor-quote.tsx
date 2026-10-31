"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../_components/lesson-rich-text";
import { getTutorQuoteText } from "../_utils/lesson-aside";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonPlayerAnswer } from "../lesson-player-types";

function isWritten(answer: LessonPlayerAnswer | undefined): boolean {
  return answer?.kind === "typedAnswer" || answer?.kind === "spokenAnswer";
}

function strong(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

export function TutorQuote() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();
  const { step } = screen;
  const quoted = step ? getTutorQuoteText(step) : null;

  if (!step || !quoted) {
    return null;
  }

  const answer = state.answers[step.id];
  const result = state.results[step.id];
  const answerText = state.phase === "feedback" && step.kind !== "hook" ? result?.answerText : null;
  const question = () => <LessonRichText text={quoted} />;
  const written = isWritten(answer);

  return (
    <p
      className="text-muted-foreground border-input mx-4 mt-3.5 line-clamp-2 border-l-2 pl-2.5 text-xs leading-relaxed"
      data-slot="tutor-quote"
    >
      {!answerText && t.rich("About “<question></question>”", { question })}

      {answerText &&
        written &&
        t.rich("You wrote <strong>{answer}</strong> on “<question></question>”", {
          answer: answerText,
          question,
          strong,
        })}

      {answerText &&
        !written &&
        t.rich("You picked <strong>{answer}</strong> on “<question></question>”", {
          answer: answerText,
          question,
          strong,
        })}
    </p>
  );
}
