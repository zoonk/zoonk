import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type SavedWord } from "./save-vocabulary-words-step";

export async function updateVocabularyEnrichmentsStep(
  savedWords: SavedWord[],
  pronunciations: Record<string, string>,
  audioUrls: Record<string, string>,
): Promise<void> {
  "use step";

  if (savedWords.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "updateVocabularyEnrichments" });

  const updates = savedWords
    .map((saved) => {
      const pronunciation = pronunciations[saved.word];
      const audioUrl = audioUrls[saved.word];

      if (!pronunciation && !audioUrl) {
        return null;
      }

      return prisma.word.update({
        data: {
          ...(audioUrl ? { audioUrl } : {}),
          ...(pronunciation ? { pronunciation } : {}),
        },
        where: { id: saved.wordId },
      });
    })
    .filter((update) => update !== null);

  if (updates.length > 0) {
    const { error } = await safeAsync(() => prisma.$transaction(updates));

    if (error) {
      await streamStatus({ status: "error", step: "updateVocabularyEnrichments" });
      return;
    }
  }

  await streamStatus({ status: "completed", step: "updateVocabularyEnrichments" });
}
