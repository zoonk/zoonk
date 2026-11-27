import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { lessonProblem } from "../../_utils/lesson-problem";
import { type Resolution, refuse } from "../../_utils/resolved-change";
import { defineFixHandler, idSchema } from "../fix-handler";
import { applyLessonScreens } from "./apply";
import { buildScreens } from "./build";
import { resolvePublishedScreens } from "./link-media";
import { checkProposedMedia } from "./media";
import { changedRows, checkScreenReferences, screenItemIds } from "./references";
import {
  type ScreenList,
  type StoredScreens,
  setScreensSchema,
  storedScreensSchema,
} from "./schema";
import { readLessonScreens } from "./snapshot";
import { distractorEffects, resolveVocabulary } from "./vocabulary";

type Proposal =
  | { id: string; setScreens: ScreenList }
  | { id: string; restore: StoredScreens; allocated?: StoredScreens };

async function resolve(
  db: TransactionClient,
  proposed: Proposal,
  allocated?: StoredScreens,
): Promise<Resolution<StoredScreens>> {
  const { id } = proposed;

  const unavailable = await lessonProblem(db, id);

  if (unavailable) {
    return refuse(unavailable);
  }

  const [lesson, latest] = await Promise.all([
    readLessonScreens(db, id),
    db.step.aggregate({ _max: { version: true }, where: { lessonId: id } }),
  ]);

  if (!lesson) {
    return refuse("id: this lesson is missing. Choose a published lesson.");
  }

  const { before } = lesson;
  const version = (latest._max.version ?? 0) + 1;
  const problems: string[] = [];

  const build = async () => {
    if ("restore" in proposed) {
      const { restore } = proposed;

      if (!isDeepStrictEqual(before, restore.after)) {
        problems.push(
          "version: the lesson changed after approval. Review its current screens before reverting.",
        );
      }

      const after = {
        ...restore.before,
        screens: restore.before.screens.map((row, i) => ({
          ...row,
          id: allocated?.after.screens[i]?.id ?? randomUUID(),
          variants: row.variants.map((variant, j) => ({
            ...variant,
            id: allocated?.after.screens[i]?.variants[j]?.id ?? randomUUID(),
          })),
        })),
        version,
      };

      return { after, effects: [], media: [], mediaLinks: [], newItems: [], proposal: null };
    }

    const list = proposed.setScreens;

    if (list.version !== before.version) {
      problems.push(
        `version: expected ${String(before.version)}. Reload the lesson and review the current screens.`,
      );
    }

    const vocabulary = await resolveVocabulary(db, { allocated, lesson, list, problems });

    const { effects, screens, summary, newItems } = buildScreens({
      allocated,
      lesson,
      list,
      problems,
      vocabulary,
    });

    const pending = await checkProposedMedia(db, { lesson, list, problems, screens });

    return {
      after: {
        screens,
        sentences: vocabulary.sentences,
        summary,
        version,
        words: vocabulary.words,
      },
      effects: [...distractorEffects({ list, ...vocabulary }), ...effects],
      media: [...vocabulary.media, ...pending.map(({ need }) => need)],
      mediaLinks: [...vocabulary.mediaLinks, ...pending.map(({ link }) => link)],
      newItems,
      proposal: list,
    };
  };

  const { after, effects, media, mediaLinks, newItems, proposal } = await build();

  await checkScreenReferences(db, { after, before, mediaLinks, newItems, problems });

  if (problems.length > 0) {
    return refuse(problems.map((problem) => `setScreens.${problem}`).join("\n"));
  }

  return {
    effects,
    media,
    ok: true,
    stored: {
      after,
      before,
      changedSentenceIds: changedRows(before.sentences, after.sentences),
      changedWordIds: changedRows(before.words, after.words),
      id,
      ...(mediaLinks.length > 0 && { mediaLinks }),
      model: "Lesson",
      newItems,
      op: "setScreens",
      proposal,
    },
    unit: { id, kind: "lesson" },
  };
}

const proposal = z.strictObject({
  id: idSchema,
  model: z.literal("Lesson"),
  setScreens: setScreensSchema,
});
export const lessonSetScreens = defineFixHandler({
  apply: applyLessonScreens,
  model: "Lesson",
  op: "setScreens",
  planRoots: ({ id, before, after, newItems }) => {
    const previous = screenItemIds(before);
    const next = screenItemIds(after);

    const itemIds = [
      ...previous.filter((item) => !next.includes(item)),
      ...next.filter((item) => !previous.includes(item)),
    ];

    return {
      itemIds,
      lessonIds: itemIds.length > 0 ? [id] : [],
      skillIds: newItems.map(({ skillId }) => skillId),
    };
  },
  proposal: {
    example: {
      id: "0193cfe6-604d-7fb2-ad00-f968c7542841",
      model: "Lesson",
      setScreens: {
        screens: [
          { id: "0193cfe6-604d-7fb2-ad00-f968c7542842" },
          {
            content: { text: "Two halves make one whole.", title: "Putting halves together" },
            kind: "explanation",
            picture: {
              alt: "Two halves of an orange",
              prompt: "Two equal orange halves side by side",
            },
          },
        ],
        version: 1,
      },
    },
    rules:
      "version is the lesson's current version from pnpm zoonk staff lesson. screens is the final ordered list: {id} keeps a screen, an id with content, variants (by id), citation, mediaAssetId or idea edits it, {kind, …} adds one, and a screen left out is removed. vocabulary and translation screens take word; reading, listening and a linked spokenAnswer take sentence: a lesson word or sentence id, or a declared key. words, sentences and ideas, when sent, are the final lists. A word or sentence entry is {id} to keep, {id, …fields} to edit, or {key, word or sentence, …all fields} to declare; a new shared word or sentence may declare romanization, and a sentence declares its reviewed otherSentenceOrders and otherTranslationOrders ([] when none). A word's distractors are the wrong options on its translation screen: words in the word's own language that a learner could confuse with it, never a translation. Every row needs a screen. An idea is {from} to keep, {from, text, label} to reword, or {text, label} to add; a screen's idea is an index in the final list. An added screen trains the skillId it names, a skill linked to the lesson, or else the lesson's first skill; a question needs one. A numeric check is {kind: check, numeric: {context, question, math, correctReason}}, its question showing each math variable as {name}. picture: {prompt, alt} draws a new screen picture. New ideas' icons, new pictures and declared words or sentences without audio are produced at proposal; an alphabet card with audioUrl null gets a clip. An explanation or worked example whose text changes gets the example box and underline it lacks marked at proposal; {id, remark: true} marks a kept explanation's example box anew, replacing the one it has (one that frames the wrong part, or none), keeping it when the new marking frames nothing, and fills an underline it lacks. A kept question's basis.position follows its quoted screen; a new one counts in the final list.",
    schema: proposal,
  },
  resolve: (db, input: Proposal & { allocated?: StoredScreens }) =>
    resolve(db, input, input.allocated),
  revert: (db, stored, context) => {
    const after = resolvePublishedScreens(stored, context);

    const before = {
      ...stored.before,
      sentences: stored.before.sentences.map((row) => ({
        ...row,
        audioUrl: after.sentences.find(({ id }) => id === row.id)?.audioUrl ?? row.audioUrl,
      })),
      words: stored.before.words.map((row) => ({
        ...row,
        audioUrl: after.words.find(({ id }) => id === row.id)?.audioUrl ?? row.audioUrl,
      })),
    };

    return resolve(db, { id: stored.id, restore: { ...stored, after, before } });
  },
  stored: storedScreensSchema,
  table: sql`library_lessons`,
  targets: ({ id, before, after }) => [
    { id, model: "Lesson", part: "screens" },
    { id, model: "Lesson", part: "summary" },
    { id, model: "Lesson", part: "setSkills" },
    ...before.words.flatMap((word) =>
      ["translation", "note", "distractors"].map((field) => ({
        id: word.id,
        model: "LessonWord",
        part: `${id}.${field}`,
      })),
    ),
    ...before.sentences.flatMap((sentence) =>
      ["translation", "explanation", "distractors", "translationDistractors"].map((field) => ({
        id: sentence.id,
        model: "LessonSentence",
        part: `${id}.${field}`,
      })),
    ),
    ...[...before.screens, ...after.screens].flatMap((row) =>
      row.itemId ? [{ id: row.itemId, model: "Item", part: "content" }] : [],
    ),
    ...before.screens.flatMap((screen) => [
      ...["content", "picture", "sourcePage", "citations"].map((part) => ({
        id: screen.id,
        model: "Step",
        part,
      })),
      ...screen.variants.map((variant) => ({
        id: variant.id,
        model: "StepVariant",
        part: "content",
      })),
    ]),
  ],
  toProposed: (stored): Proposal & { allocated?: StoredScreens } =>
    stored.proposal
      ? { allocated: stored, id: stored.id, setScreens: stored.proposal }
      : {
          allocated: stored,
          id: stored.id,
          restore: { ...stored, after: stored.before, before: stored.after },
        },
});
