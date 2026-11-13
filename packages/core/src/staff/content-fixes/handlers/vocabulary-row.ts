import { type TransactionClient, sql } from "@zoonk/db";

export type VocabularyModel = "Sentence" | "Word";

export const TEXT_FIELD = { Sentence: "sentence", Word: "word" } as const;
export const UNIT_KIND = { Sentence: "sentence", Word: "word" } as const;
export const TABLE = { Sentence: sql`sentences`, Word: sql`words` } as const;

export type VocabularyRow = {
  organizationId: string;
  romanization: string | null;
  targetLanguage: string;
  text: string;
};

export async function loadRow(
  db: TransactionClient,
  { id, model }: { id: string; model: VocabularyModel },
): Promise<VocabularyRow | null> {
  const select = { organizationId: true, romanization: true, targetLanguage: true } as const;

  if (model === "Word") {
    const word = await db.word.findUnique({ select: { ...select, word: true }, where: { id } });
    return word && { ...word, text: word.word };
  }

  const sentence = await db.sentence.findUnique({
    select: { ...select, sentence: true },
    where: { id },
  });

  return sentence && { ...sentence, text: sentence.sentence };
}
