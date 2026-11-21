"use client";

import { useExtracted } from "next-intl";
import { LessonRichLine } from "../_components/lesson-rich-text";
import { getTutorQuoteText } from "../_utils/lesson-aside";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonPlayerAnswer } from "../lesson-player-types";

function isWritten(answer: LessonPlayerAnswer | undefined): boolean {
  return answer?.kind === "typedAnswer" || answer?.kind === "spokenAnswer";
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground font-medium">{children}</span>;
}

function strong(chunks: React.ReactNode) {
  return <Strong>{chunks}</Strong>;
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
  const question = () => <LessonRichLine text={quoted} />;
  const written = isWritten(answer);

  // A pick is lesson text, which may be code, so it shows as the lesson draws it, on one line.
  const picked = () => (
    <Strong>
      <LessonRichLine text={answerText ?? ""} />
    </Strong>
  );

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
          strong: picked,
        })}
    </p>
  );
}
