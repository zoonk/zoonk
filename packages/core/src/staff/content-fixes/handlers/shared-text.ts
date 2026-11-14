import {
  WARM_UP_DECK_SIZE,
  isPlayableWarmUpCard,
  warmUpCardSchema,
} from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { sql } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { conversationScenarioSchema } from "../../../language/conversations/conversation-contract";
import { PRIVATE_CONTENT, toJson } from "../_utils/resolved-change";
import { sharedRowHandler } from "./shared-row";

const text = z.string().trim().min(1);
const skillFields = { description: text, example: text.nullable(), name: text };

export const skillSet = sharedRowHandler({
  fields: skillFields,
  load: async (db, id) => {
    const row = await db.skill.findUnique({ where: { id } });

    return (
      row && {
        problem:
          (row.ownerId || row.visibility !== "public" ? PRIVATE_CONTENT : undefined) ||
          (row.mergedIntoId ? `Use surviving Skill ${row.mergedIntoId}.` : undefined),
        roots: { skillIds: [id] },
        row: { description: row.description, example: row.example, name: row.name },
        unit: { id, kind: "skill" },
      }
    );
  },
  model: "Skill",
  rules: "Public unmerged skills with no owner. Identity stays; plans refresh on their next write.",
  table: sql`skills`,
  write: (tx, id, values) => {
    const data = z.object(skillFields).partial().parse(values);

    return tx.skill.update({
      data: { ...data, ...(data.name ? { normalizedName: normalizeString(data.name) } : {}) },
      where: { id },
    });
  },
});

export const warmUpSet = sharedRowHandler({
  fields: { cards: z.array(warmUpCardSchema).min(2).max(WARM_UP_DECK_SIZE.max) },
  load: async (db, id) => {
    const row = await db.warmUp.findUnique({ where: { id } });

    return (
      row && {
        problem: row.status === "ready" ? undefined : "Only ready decks can be fixed.",
        row: { cards: toJson(row.cards) },
        unit: { id, kind: "warmUp" },
      }
    );
  },
  model: "WarmUp",
  rules: "Ready shared decks only. Card and option ids, order stay; loaded decks keep their copy.",
  table: sql`warm_ups`,
  validate: (row, next) => {
    const before = z.array(warmUpCardSchema).safeParse(row.cards);
    const after = z.array(warmUpCardSchema).parse(next.cards);

    if (!after.every((card) => isPlayableWarmUpCard(card))) {
      return "Every card must be playable with one correct option.";
    }

    return before.success &&
      JSON.stringify(
        before.data.map((card) => [card.id, card.options.map((option) => option.id)]),
      ) === JSON.stringify(after.map((card) => [card.id, card.options.map((option) => option.id)]))
      ? null
      : "Keep card and option ids and order.";
  },
  write: (tx, id, values) =>
    tx.warmUp.update({
      data: { cards: z.array(warmUpCardSchema).parse(values.cards) },
      where: { id },
    }),
});

export const scenarioSet = sharedRowHandler({
  fields: { content: conversationScenarioSchema },
  load: async (db, id) => {
    const row = await db.conversationScenario.findUnique({
      include: { chapter: { select: { ownerId: true, visibility: true } } },
      where: { id },
    });

    return (
      row && {
        problem:
          row.chapter.ownerId || row.chapter.visibility !== "public" ? PRIVATE_CONTENT : undefined,
        row: { content: toJson(row.content) },
        unit: { id: row.chapterId, kind: "chapter" },
      }
    );
  },
  model: "ConversationScenario",
  rules:
    "Public chapters with no owner. Existing conversations keep their scenario snapshot; future conversations read the fix.",
  table: sql`conversation_scenarios`,
  write: (tx, id, values) =>
    tx.conversationScenario.update({
      data: { content: conversationScenarioSchema.parse(values.content) },
      where: { id },
    }),
});

export const tutorAnswerSet = sharedRowHandler({
  fields: { answer: text },
  load: async (db, id) => {
    const row = await db.tutorSharedAnswer.findUnique({
      include: {
        step: {
          select: {
            lesson: { select: { ownerId: true, visibility: true } },
            lessonId: true,
            retiredAt: true,
            staged: true,
          },
        },
      },
      where: { id },
    });

    return (
      row && {
        problem:
          (row.step.lesson.ownerId || row.step.lesson.visibility !== "public"
            ? PRIVATE_CONTENT
            : undefined) ||
          (row.step.retiredAt !== null || row.step.staged
            ? "Only current screens can be fixed."
            : undefined),
        row: { answer: row.answer },
        unit: { id: row.step.lessonId, kind: "lesson" },
      }
    );
  },
  model: "TutorSharedAnswer",
  rules:
    "Current screens of published public lessons only. Saved learner questions keep their own answer.",
  table: sql`tutor_shared_answers`,
  write: (tx, id, values) =>
    tx.tutorSharedAnswer.update({ data: { answer: text.parse(values.answer) }, where: { id } }),
});

export const mediaAltSet = sharedRowHandler({
  fields: { alt: text.nullable() },
  load: async (db, id) => {
    const row = await db.mediaAsset.findUnique({
      select: { alt: true, ownerId: true, visibility: true },
      where: { id },
    });

    return (
      row && {
        problem: row.ownerId || row.visibility !== "public" ? PRIVATE_CONTENT : undefined,
        row: { alt: row.alt },
        unit: { id, kind: "mediaAsset" },
      }
    );
  },
  model: "MediaAsset",
  rules:
    "Public assets with no owner. Corrects the stored picture-check alt text. Learner-facing alt text lives in screen and item content and is fixed there; pixels stay.",
  table: sql`media_assets`,
  write: (tx, id, values) =>
    tx.mediaAsset.update({ data: { alt: text.nullable().parse(values.alt) }, where: { id } }),
});
