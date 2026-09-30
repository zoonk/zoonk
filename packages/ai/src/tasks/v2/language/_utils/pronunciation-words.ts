/** How one word of the expected sentence came out in the recording. */
type PronouncedWordStatus = "correct" | "different" | "missed";

/** What was off in a word said differently; null when it was another word or form. */
type PronunciationIssue = "sound" | "stress";

export type PronouncedWord = {
  /** The word as written in the expected sentence. */
  text: string;
  status: PronouncedWordStatus;
  /** What it sounded like, only when it was said differently. */
  heard: string | null;
  issue: PronunciationIssue | null;
};

/** A model's verdict for the word at `number` (1-based) of the numbered list it got. */
type NumberedWordVerdict = {
  number: number;
  status: PronouncedWordStatus;
  heard: string | null;
  issue: PronunciationIssue | null;
};

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The words a learner is asked to say, as written, so results show the
 * sentence the learner saw. Stray punctuation ("-") isn't a word to say.
 */
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
 * Puts a model's verdicts back on the expected words by number, so the result
 * always has every word in order, as written. A word the model skipped, or
 * called different without saying what it heard, counts as said right: an
 * unclear verdict shouldn't flag a learner.
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
