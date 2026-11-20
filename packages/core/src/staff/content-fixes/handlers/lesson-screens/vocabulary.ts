import { type TransactionClient } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type ScreenList, type ScreenSnapshot } from "./schema";
import { type ScreenLesson } from "./snapshot";

export async function resolveVocabulary(
  db: TransactionClient,
  { lesson, list, problems }: { lesson: ScreenLesson; list: ScreenList; problems: string[] },
) {
  const { before, targetLanguage } = lesson;
  const declaredWords = list.words?.flatMap((row) => ("word" in row ? [row.word] : [])) ?? [];

  const declaredSentences =
    list.sentences?.flatMap((row) => ("sentence" in row ? [row.sentence] : [])) ?? [];

  const org = before.words[0]?.organizationId ?? before.sentences[0]?.organizationId;

  const scope = {
    ...(org ? { organizationId: org } : { organization: { slug: AI_ORG_SLUG } }),
    targetLanguage: targetLanguage ?? "",
  };

  const [bankWords, bankSentences] = await Promise.all([
    declaredWords.length > 0
      ? db.word.findMany({ where: { ...scope, word: { in: declaredWords } } })
      : [],
    declaredSentences.length > 0
      ? db.sentence.findMany({ where: { ...scope, sentence: { in: declaredSentences } } })
      : [],
  ]);

  const wordRefs = new Map<string, string>();
  const sentenceRefs = new Map<string, string>();

  function link(refs: Map<string, string>, key: string, id: string, path: string) {
    if (refs.has(key) || [...refs.values()].includes(id)) {
      problems.push(`${path}: duplicate key or row. Keep one entry per shared row.`);
    }

    if (refs.has(id) && refs.get(id) !== id) {
      problems.push(`${path}.key: use a key distinct from another row ID.`);
    }

    refs.set(key, id);
    refs.set(id, id);
  }

  const words =
    list.words?.flatMap((entry, index): ScreenSnapshot["words"] => {
      const path = `words[${String(index)}]`;

      if ("id" in entry) {
        const row = before.words.find(({ id }) => id === entry.id);

        if (row) {
          link(wordRefs, row.id, row.id, path);
          return [{ ...row, ...entry, note: entry.note === undefined ? row.note : entry.note }];
        }

        problems.push(`${path}.id: use a current lesson word ID or declare its text with a key.`);
        return [];
      }

      const row = bankWords.find((candidate) => candidate.word === entry.word);

      if (!row?.audioUrl) {
        problems.push(
          `${path}.word: "${entry.word}" needs a shared word with recorded audio in ${targetLanguage ?? "the lesson language"}.`,
        );

        return [];
      }

      link(wordRefs, entry.key, row.id, path);

      return [
        {
          audioUrl: row.audioUrl,
          distractors: entry.distractors,
          id: row.id,
          note: entry.note ?? null,
          organizationId: row.organizationId,
          romanization: row.romanization,
          translation: entry.translation,
          word: row.word,
        },
      ];
    }) ?? before.words;

  const sentences =
    list.sentences?.flatMap((entry, index): ScreenSnapshot["sentences"] => {
      const path = `sentences[${String(index)}]`;

      if ("id" in entry) {
        const row = before.sentences.find(({ id }) => id === entry.id);

        if (row) {
          link(sentenceRefs, row.id, row.id, path);

          if (
            entry.translation &&
            entry.translation !== row.translation &&
            !entry.otherTranslationOrders
          ) {
            problems.push(
              `${path}.otherTranslationOrders: review the accepted orders for the new translation. Send [] when there are none.`,
            );
          }

          return [
            {
              ...row,
              ...entry,
              ordersOwedAt:
                entry.otherSentenceOrders && entry.otherTranslationOrders ? null : row.ordersOwedAt,
            },
          ];
        }

        problems.push(
          `${path}.id: use a current lesson sentence ID or declare its text with a key.`,
        );

        return [];
      }

      const row = bankSentences.find((candidate) => candidate.sentence === entry.sentence);

      if (!row?.audioUrl) {
        problems.push(
          `${path}.sentence: "${entry.sentence}" needs a shared sentence with recorded audio in ${targetLanguage ?? "the lesson language"}.`,
        );

        return [];
      }

      link(sentenceRefs, entry.key, row.id, path);
      const { key: _key, ...fields } = entry;

      return [
        {
          ...fields,
          audioUrl: row.audioUrl,
          id: row.id,
          ordersOwedAt: null,
          organizationId: row.organizationId,
          romanization: row.romanization,
        },
      ];
    }) ?? before.sentences;

  for (const row of words) {
    wordRefs.set(row.id, row.id);
  }

  for (const row of sentences) {
    sentenceRefs.set(row.id, row.id);
  }

  return { sentenceRefs, sentences, wordRefs, words };
}
