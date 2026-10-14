"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../_components/lesson-rich-text";
import { getTutorQuoteText } from "../_utils/lesson-aside";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonPlayerAnswer } from "../lesson-player-types";

/** The learner's answer as the quote names it: picked from options, or written. */
function isWritten(answer: LessonPlayerAnswer | undefined): boolean {
  return answer?.kind === "typedAnswer" || answer?.kind === "spokenAnswer";
}

/** The learner's answer in the quote, a step brighter than the words around it. */
function strong(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

/**
 * The screen the learner asks about, quoted as the conversation's first line in the drawer that
 * covers the bottom of the lesson: the question, with their answer once it's checked ("You picked
 * 100% on “A price rises…”"). Screens without such a line aren't quoted.
 */
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
