import { type StepKind } from "@zoonk/db";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";

/**
 * Personal writing has no single sample answer. Only show the learner's corrected text when
 * each correction identifies one non-overlapping part of the original. Form key points can be
 * marked missing because of those same errors; the corrections still belong in the notebook.
 */
export function getMistakeCorrectAnswer({
  kind,
  targetLanguage,
  verdict,
}: {
  kind: StepKind;
  targetLanguage: string | null;
  verdict: LessonAnswerVerdict;
}): string | null {
  if (kind !== "typedAnswer" || !targetLanguage) {
    return verdict.correctAnswer;
  }

  const { answerText, corrections } = verdict;

  if (!answerText || corrections.length === 0) {
    return null;
  }

  const edits = corrections
    .map(({ right, wrong }) => ({
      end: answerText.indexOf(wrong) + wrong.length,
      right,
      start: wrong ? answerText.indexOf(wrong) : -1,
      wrong,
    }))
    .toSorted((left, right) => left.start - right.start);

  const ambiguous = edits.some(
    (edit, index) =>
      edit.start < 0 ||
      answerText.includes(edit.wrong, edit.start + 1) ||
      edit.start < (edits[index - 1]?.end ?? 0),
  );

  if (ambiguous) {
    return null;
  }

  const corrected = edits.reduce(
    (result, edit) => ({
      end: edit.end,
      text: result.text + answerText.slice(result.end, edit.start) + edit.right,
    }),
    { end: 0, text: "" },
  );

  return corrected.text + answerText.slice(corrected.end);
}
