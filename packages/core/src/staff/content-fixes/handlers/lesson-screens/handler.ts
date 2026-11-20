import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { lessonProblem } from "../../_utils/lesson-problem";
import { type Resolution, refuse, toJson } from "../../_utils/resolved-change";
import { defineFixHandler, idSchema } from "../fix-handler";
import { applyLessonScreens } from "./apply";
import { buildScreens } from "./build";
import { checkProposedMedia } from "./media";
import { changedRows, checkScreenReferences, screenItemIds } from "./references";
import {
  type ScreenList,
  type StoredScreens,
  setScreensSchema,
  storedScreensSchema,
} from "./schema";
import { readLessonScreens } from "./snapshot";
import { resolveVocabulary } from "./vocabulary";

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

      return { after, newItems: [], proposal: null };
    }

    const list = proposed.setScreens;

    if (list.version !== before.version) {
      problems.push(
        `version: expected ${String(before.version)}. Reload the lesson and review the current screens.`,
      );
    }

    const vocabulary = await resolveVocabulary(db, { lesson, list, problems });

    const { screens, summary, newItems } = buildScreens({
      allocated,
      lesson,
      list,
      problems,
      vocabulary,
    });

    await checkProposedMedia(db, { lesson, list, problems, screens });

    return {
      after: {
        screens,
        sentences: vocabulary.sentences,
        summary,
        version,
        words: vocabulary.words,
      },
      newItems,
      proposal: list,
    };
  };

  const { after, newItems, proposal } = await build();

  const [references, beforeReferences] = await Promise.all([
    checkScreenReferences(db, { after, before, newItems, problems }),
    checkScreenReferences(db, { after: before, before, newItems: [], problems: [] }),
  ]);

  if ("restore" in proposed && !isDeepStrictEqual(references, proposed.restore.beforeReferences)) {
    problems.push(
      "references: an original picture or practice question changed. Review the current item before restoring it.",
    );
  }

  if (problems.length > 0) {
    return refuse(problems.map((problem) => `setScreens.${problem}`).join("\n"));
  }

  return {
    effects: [],
    ok: true,
    stored: {
      after,
      before,
      beforeReferences: toJson(beforeReferences),
      changedSentenceIds: changedRows(before.sentences, after.sentences),
      changedWordIds: changedRows(before.words, after.words),
      id,
      model: "Lesson",
      newItems,
      op: "setScreens",
      proposal,
      references: toJson(references),
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
  planRoots: ({ before, after, newItems }) => ({
    itemIds: [...screenItemIds(before), ...screenItemIds(after)],
    skillIds: newItems.map(({ skillId }) => skillId),
  }),
  proposal: {
    rules:
      "version and screens are required. Order the final list. Keep or edit by id. Add by kind with content, word or sentence (shared ID or declaration key). A numeric check takes numeric: {context, question, math, correctReason} and skillId. Optional words, sentences and ideas replace those lists. An idea index addresses the final list. Kept variants are edited by id. Kept basis positions follow the quoted source. New basis positions refer to the final list.",
    schema: proposal,
  },
  resolve: (db, input: Proposal & { allocated?: StoredScreens }) =>
    resolve(db, input, input.allocated),
  revert: (db, stored) => resolve(db, { id: stored.id, restore: stored }),
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
          restore: {
            ...stored,
            after: stored.before,
            before: stored.after,
            beforeReferences: stored.references,
            references: stored.beforeReferences,
          },
        },
});
