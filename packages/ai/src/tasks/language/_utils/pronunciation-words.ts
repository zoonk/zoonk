type PronouncedWordStatus = "correct" | "different" | "missed";

/** Null when it was another word or form. */
type PronunciationIssue = "sound" | "stress";

export type PronouncedWord = {
  text: string;
  status: PronouncedWordStatus;
  /** Only when it was said differently. */
  heard: string | null;
  issue: PronunciationIssue | null;
};

/** `number` is 1-based. */
type NumberedWordVerdict = {
  number: number;
  status: PronouncedWordStatus;
  heard: string | null;
  issue: PronunciationIssue | null;
};

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** Stray punctuation ("-") isn't a word to say. */
export function splitExpectedWords(expectedText: string): string[] {
  return expectedText.split(/\s+/u).filter((word) => HAS_LETTER_OR_DIGIT.test(word));
}

function toPronouncedWord({
  text,
  verdict,
}: {
  text: string;
  verdict: NumberedWordVerdict | undefined;
}): PronouncedWord {
  const heard = verdict?.heard?.trim();

  if (verdict?.status === "different" && heard) {
    return { heard, issue: verdict.issue, status: "different", text };
  }

  if (verdict?.status === "missed") {
    return { heard: null, issue: null, status: "missed", text };
  }

  return { heard: null, issue: null, status: "correct", text };
}

/**
 * A word the model skipped, or called different without saying what it heard, counts as said
 * right: an unclear verdict shouldn't flag a learner.
 */
export function toPronouncedWords({
  expectedWords,
  verdicts,
}: {
  expectedWords: readonly string[];
  verdicts: readonly NumberedWordVerdict[];
}): PronouncedWord[] {
  const byNumber = new Map(verdicts.map((verdict) => [verdict.number, verdict]));

  return expectedWords.map((text, index) =>
    toPronouncedWord({ text, verdict: byNumber.get(index + 1) }),
  );
}
