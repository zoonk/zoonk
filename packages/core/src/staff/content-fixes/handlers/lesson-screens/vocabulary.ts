import { randomUUID } from "node:crypto";
import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type ContentFixMediaNeed, clipMediaKey } from "../../media-schema";
import {
  type ScreenList,
  type ScreenMediaLink,
  type ScreenSnapshot,
  type StoredScreens,
} from "./schema";
import { type ScreenLesson } from "./snapshot";

async function readVocabularyBank(
  db: TransactionClient,
  { lesson, list, problems }: { lesson: ScreenLesson; list: ScreenList; problems: string[] },
) {
  const { before, targetLanguage } = lesson;
  const declaredWords = list.words?.flatMap((row) => ("word" in row ? [row.word] : [])) ?? [];

  const declaredSentences =
    list.sentences?.flatMap((row) => ("sentence" in row ? [row.sentence] : [])) ?? [];

  if (new Set(declaredWords).size !== declaredWords.length) {
    problems.push("words: declare each shared word only once.");
  }

  if (new Set(declaredSentences).size !== declaredSentences.length) {
    problems.push("sentences: declare each shared sentence only once.");
  }

  const org = before.words[0]?.organizationId ?? before.sentences[0]?.organizationId;

  const organization =
    declaredWords.length + declaredSentences.length > 0
      ? await db.organization.findUnique({
          select: { id: true, slug: true },
          where: org ? { id: org } : { slug: AI_ORG_SLUG },
        })
      : null;

  const scope = { organizationId: organization?.id, targetLanguage: targetLanguage ?? "" };

  const [bankWords, bankSentences] = await Promise.all([
    organization && declaredWords.length > 0
      ? db.word.findMany({ where: { ...scope, word: { in: declaredWords } } })
      : [],
    organization && declaredSentences.length > 0
      ? db.sentence.findMany({ where: { ...scope, sentence: { in: declaredSentences } } })
      : [],
  ]);

  return { bankSentences, bankWords, organization };
}

function editSentence(
  row: ScreenSnapshot["sentences"][number],
  entry: Extract<NonNullable<ScreenList["sentences"]>[number], { id: string }>,
  { path, problems }: { path: string; problems: string[] },
) {
  if (entry.translation && entry.translation !== row.translation && !entry.otherTranslationOrders) {
    problems.push(
      `${path}.otherTranslationOrders: review the accepted orders for the new translation. Send [] when there are none.`,
    );
  }

  return {
    ...row,
    ...entry,
    ordersOwedAt:
      entry.otherSentenceOrders && entry.otherTranslationOrders ? null : row.ordersOwedAt,
  };
}

function declarationRomanization({
  entry,
  row,
  model,
  path,
  problems,
}: {
  entry: { romanization?: string | null };
  row?: { romanization: string | null };
  model: "Word" | "Sentence";
  path: string;
  problems: string[];
}) {
  if (row && entry.romanization !== undefined && entry.romanization !== row.romanization) {
    problems.push(
      `${path}.romanization: this text already exists. Use ${model} set to change its shared romanization.`,
    );
  }

  return row ? row.romanization : (entry.romanization ?? null);
}

export async function resolveVocabulary(
  db: TransactionClient,
  {
    lesson,
    allocated,
    list,
    problems,
  }: { allocated?: StoredScreens; lesson: ScreenLesson; list: ScreenList; problems: string[] },
) {
  const { before, targetLanguage } = lesson;

  const { bankSentences, bankWords, organization } = await readVocabularyBank(db, {
    lesson,
    list,
    problems,
  });

  const media: ContentFixMediaNeed[] = [];
  const mediaLinks: ScreenMediaLink[] = [];

  function declareClip({
    model,
    text,
    id,
    create,
    path,
  }: {
    model: "Word" | "Sentence";
    text: string;
    id: string;
    create: boolean;
    path: string;
  }) {
    if (!targetLanguage || !isTTSSupportedLanguage(targetLanguage) || !organization) {
      problems.push(
        `${path}: no recording can be generated for this lesson. Use a shared row with audio.`,
      );

      return;
    }

    const identity = { language: targetLanguage, model, text };
    const key = clipMediaKey(identity);
    media.push({ ...identity, key, kind: "clip", orgSlug: organization.slug });

    mediaLinks.push({
      create,
      id,
      key,
      language: targetLanguage,
      target: model === "Word" ? "word" : "sentence",
    });
  }

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

      if (!organization || !targetLanguage) {
        problems.push(`${path}.word: choose a lesson with a shared vocabulary language.`);
        return [];
      }

      const id = row?.id ?? allocated?.after.words[index]?.id ?? randomUUID();

      if (!row?.audioUrl) {
        declareClip({ create: !row, id, model: "Word", path: `${path}.word`, text: entry.word });
      }

      link(wordRefs, entry.key, id, path);

      return [
        {
          audioUrl: row?.audioUrl ?? null,
          distractors: entry.distractors,
          id,
          note: entry.note ?? null,
          organizationId: organization.id,
          romanization: declarationRomanization({ entry, model: "Word", path, problems, row }),
          translation: entry.translation,
          word: entry.word,
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

          return [editSentence(row, entry, { path, problems })];
        }

        problems.push(
          `${path}.id: use a current lesson sentence ID or declare its text with a key.`,
        );

        return [];
      }

      const row = bankSentences.find((candidate) => candidate.sentence === entry.sentence);

      if (!organization || !targetLanguage) {
        problems.push(`${path}.sentence: choose a lesson with a shared vocabulary language.`);
        return [];
      }

      const id = row?.id ?? allocated?.after.sentences[index]?.id ?? randomUUID();

      if (!row?.audioUrl) {
        declareClip({
          create: !row,
          id,
          model: "Sentence",
          path: `${path}.sentence`,
          text: entry.sentence,
        });
      }

      link(sentenceRefs, entry.key, id, path);
      const { key: _key, ...fields } = entry;

      return [
        {
          ...fields,
          audioUrl: row?.audioUrl ?? null,
          id,
          ordersOwedAt: null,
          organizationId: organization.id,
          romanization: declarationRomanization({ entry, model: "Sentence", path, problems, row }),
        },
      ];
    }) ?? before.sentences;

  for (const row of words) {
    wordRefs.set(row.id, row.id);
  }

  for (const row of sentences) {
    sentenceRefs.set(row.id, row.id);
  }

  return { media, mediaLinks, sentenceRefs, sentences, wordRefs, words };
}
