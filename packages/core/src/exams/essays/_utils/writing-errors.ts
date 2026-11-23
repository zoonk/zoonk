import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";

function exactStart(text: string, quote: string | null): number | null {
  if (!quote?.trim()) {
    return null;
  }

  const start = text.indexOf(quote);
  return start !== -1 && !text.includes(quote, start + 1) ? start : null;
}

export function verifyWritingErrors(eligible: string, errors: WritingEvidence["errors"]) {
  const candidates = errors.flatMap((error) => {
    const start = exactStart(eligible, error.quote);

    return start !== null &&
      error.correction.trim() &&
      error.kind.trim() &&
      error.correction !== error.quote
      ? [{ ...error, start }]
      : [];
  });

  const unique = [...new Map(candidates.map((error) => [JSON.stringify(error), error])).values()];

  return unique
    .filter(
      (error) =>
        !unique.some(
          (other) =>
            other !== error &&
            other.start < error.start + error.quote.length &&
            error.start < other.start + other.quote.length,
        ),
    )
    .toSorted((first, second) => first.start - second.start);
}
