import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";

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

export const clipSchema = z.object({
  audioGeneratedAt: z.iso.datetime().nullable(),
  audioModel: z.string().nullable(),
  audioPromptVersion: z.string().nullable(),
  audioRunId: z.string().nullable(),
  audioUrl: z.string().nullable(),
});

export type Clip = z.infer<typeof clipSchema>;

const CLIP_COLUMNS = {
  audioGeneratedAt: true,
  audioModel: true,
  audioPromptVersion: true,
  audioRunId: true,
  audioUrl: true,
} as const;

export async function loadClip(
  db: TransactionClient,
  { id, model }: { id: string; model: VocabularyModel },
): Promise<Clip | null> {
  const row =
    model === "Word"
      ? await db.word.findUnique({ select: CLIP_COLUMNS, where: { id } })
      : await db.sentence.findUnique({ select: CLIP_COLUMNS, where: { id } });

  return row && { ...row, audioGeneratedAt: row.audioGeneratedAt?.toISOString() ?? null };
}

export function toClipData({ audioGeneratedAt, ...clip }: Clip) {
  return { ...clip, audioGeneratedAt: audioGeneratedAt ? new Date(audioGeneratedAt) : null };
}
