import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";

/**
 * Word-bank fixtures should default optional render metadata to null so tests can
 * describe only the romanization, translation or audio detail that matters to
 * the behavior under test.
 */
export function buildWordBankOption({
  word,
  ...overrides
}: Partial<Omit<WordBankOption, "word">> & Pick<WordBankOption, "word">): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word, ...overrides };
}
