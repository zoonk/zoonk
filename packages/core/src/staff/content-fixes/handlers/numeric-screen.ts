import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { ZodError } from "zod";
import { parseItemContent } from "../../../library/items/item-content";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { toMathCheckContent } from "../../../library/steps/_utils/math-check-content";
import {
  type Json,
  PRIVATE_CONTENT,
  type Resolution,
  refuse,
  toJson,
} from "../_utils/resolved-change";
import { type ContentFixEffect, type StoredChange } from "../contract";
import { hasSameShape, isItemAnswerKey, listContentValueChanges } from "../screen-content-rules";
import { type FieldChange } from "./fix-handler";
import { checkScreenItemContent } from "./item-content-rules";

type AskingScreen = { id: string; lessonId: string };

type SetStored = { fields: FieldChange[]; id: string; model: "Item"; op: "set" };

const PROSE_PARTS = new Set(["misconception", "reason", "steps"]);

/** The current lesson screen that asks this practice question, if any. */
export function findAskingScreen(
  db: TransactionClient,
  itemId: string,
): Promise<AskingScreen | null> {
  return db.step.findFirst({
    select: { id: true, lessonId: true },
    where: { itemId, ...CURRENT_STEPS },
  });
}

function classifyPath(path: string): "answerKey" | "prose" | "question" {
  if (isItemAnswerKey(path)) {
    return "answerKey";
  }

  return path.split(".").some((segment) => PROSE_PARTS.has(segment)) ? "prose" : "question";
}

/**
 * A screen's numeric question changes in place, since the screen grades by option and practice
 * by the number, but never both what learners read and the numbers that decide the answer.
 */
export async function resolveScreenItemSet(
  db: TransactionClient,
  { id, screen, sent }: { id: string; screen: AskingScreen; sent: Json },
): Promise<Resolution<SetStored>> {
  const item = await db.item.findUniqueOrThrow({
    include: { skill: { select: { visibility: true } } },
    where: { id },
  });

  if (item.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  const checked = checkScreenItemContent({ item, sent });

  if ("ok" in checked) {
    return checked;
  }

  if (!hasSameShape({ after: checked.after, before: item.content })) {
    return refuse(
      "content must keep its shape: the same variables, steps and common mistakes, each with the same fields.",
    );
  }

  const changes = listContentValueChanges({ after: checked.after, before: item.content });
  const classes = new Set(changes.map((change) => classifyPath(change.path)));

  if (classes.has("answerKey") && classes.has("question")) {
    return refuse(
      "This changes both what learners read and the numbers that decide the answer. Propose one, and the other once it's approved.",
    );
  }

  const explanations = await db.answerExplanation.count({ where: { itemId: id } });

  const effects: ContentFixEffect[] = [
    ...(classes.has("answerKey")
      ? [{ id: screen.id, kind: "answerKeyChanged" as const, model: "Step" as const }]
      : []),
    ...(classes.has("question")
      ? [{ id: screen.id, kind: "questionChanged" as const, model: "Step" as const }]
      : []),
    ...(explanations > 0
      ? [{ count: explanations, itemId: id, kind: "itemExplanationsDeleted" as const }]
      : []),
  ];

  return {
    effects,
    ok: true,
    stored: {
      fields: [{ after: checked.after, before: toJson(item.content), field: "content" }],
      id,
      model: "Item",
      op: "set",
    },
    unit: { id: screen.lessonId, kind: "lesson" },
  };
}

function shownPart(content: unknown): unknown {
  const screen = isJsonObject(content) ? content : {};
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Compares as the column stores it: JSON drops undefined fields, which a clone keeps.
  return JSON.parse(
    JSON.stringify({ context: screen.context, options: screen.options, question: screen.question }),
  );
}

function correctReason(content: unknown): string {
  const options = isJsonObject(content) && Array.isArray(content.options) ? content.options : [];
  const correct = options.find((option) => isJsonObject(option) && option.isCorrect === true);
  return isJsonObject(correct) && typeof correct.reason === "string" ? correct.reason : "";
}

function safeParseNumeric(content: unknown) {
  try {
    const parsed = parseItemContent({ content, format: "numeric" });
    return parsed.format === "numeric" ? parsed : null;
  } catch (error) {
    if (error instanceof ZodError) {
      return null;
    }

    throw error;
  }
}

/** The screen as the lesson writer draws it from its question, keeping the screen's own reason. */
function renderScreen({
  item,
  language,
  screen,
}: {
  item: unknown;
  language: string;
  screen: unknown;
}): { ok: true; shown: unknown } | { ok: false; problem: string } {
  const parsed = safeParseNumeric(item);

  if (!parsed) {
    return { ok: false, problem: "The screen's practice question isn't a numeric question." };
  }

  const { context, math, question } = parsed.content;

  const rendered = toMathCheckContent({
    input: { context, correctReason: correctReason(screen), math, question },
    language,
  });

  return rendered.ok
    ? { ok: true, shown: shownPart(rendered.content) }
    : { ok: false, problem: `The question doesn't draw a screen: ${rendered.problems.join(" ")}` };
}

function changedContent(changes: readonly StoredChange[], model: "Item" | "Step") {
  return new Map(
    changes.flatMap((change) =>
      change.model === model && change.op === "set"
        ? change.fields.map((field) => [change.id, field.after] as const)
        : [],
    ),
  );
}

/**
 * A numeric screen and its practice question are one question: whichever a fix changes, the
 * screen must still be what its question draws, so the agent sends both and sees the screen
 * expected when they differ.
 */
export async function numericScreenProblem(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<string | null> {
  const screens = changedContent(changes, "Step");
  const items = changedContent(changes, "Item");

  if (items.size === 0 && screens.size === 0) {
    return null;
  }

  const steps = await db.step.findMany({
    select: {
      content: true,
      id: true,
      item: { select: { content: true, id: true } },
      lesson: { select: { language: true } },
    },
    where: {
      OR: [{ id: { in: [...screens.keys()] } }, { itemId: { in: [...items.keys()] } }],
      itemId: { not: null },
      ...CURRENT_STEPS,
    },
  });

  const problems = steps.map(({ content, id, item, lesson }) => {
    const screen = screens.get(id) ?? content;

    if (!item) {
      return null;
    }

    const drawn = renderScreen({
      item: items.get(item.id) ?? item.content,
      language: lesson.language,
      screen,
    });

    if (!drawn.ok) {
      return drawn.problem;
    }

    return isDeepStrictEqual(drawn.shown, shownPart(screen))
      ? null
      : `Step ${id} shows Item ${item.id}'s numeric question, so they change together. Send the Item's content and the screen as that question draws it: ${JSON.stringify(drawn.shown)}`;
  });

  return problems.find((problem) => problem !== null) ?? null;
}
