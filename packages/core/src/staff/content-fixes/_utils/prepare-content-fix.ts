import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { CURRENT_STEPS, readStagedLessonVersion } from "../../../library/lessons/lesson-versions";
import { getScreenReadingTexts, holdsQuote } from "../../../library/steps/question-bases";
import { type ContentFixEffect, type StoredChange, contentFixChangesSchema } from "../contract";
import { type FixTarget } from "../handlers/fix-handler";
import { numericScreenProblem } from "../handlers/numeric-screen";
import { findStoredHandler, prepareProposedChange } from "../handlers/registry";
import {
  type FixUnit,
  type Json,
  PRIVATE_CONTENT,
  type Refusal,
  type Resolution,
  refuse,
} from "./resolved-change";

export type PreparedFix = { changes: StoredChange[]; effects: ContentFixEffect[]; unit: FixUnit };

/** Reads what one change touches now and returns what it would write. */
export type ChangeResolver = (db: TransactionClient) => Promise<Resolution<unknown>>;

export function proposedChange(change: unknown): ChangeResolver {
  return (db) => prepareProposedChange(db, change);
}

export function storedChange(change: StoredChange): ChangeResolver {
  return (db) => findStoredHandler(change).reprepare(db, change);
}

export function inverseChange(change: StoredChange): ChangeResolver {
  return (db) => findStoredHandler(change).revert(db, change);
}

export function targetsOf(change: StoredChange): FixTarget[] {
  return findStoredHandler(change).targets(change);
}

function targetKey({ id, model, part }: FixTarget): string {
  return `${model}:${id}:${part}`;
}

/** Two changes of one fix writing the same thing would leave only the last one's value. */
function overlapProblem(changes: readonly StoredChange[]): string | null {
  const keys = changes.flatMap((change) => [
    ...new Set(targetsOf(change).map((target) => targetKey(target))),
  ]);

  return new Set(keys).size === keys.length
    ? null
    : "Each row appears once in a fix; put all of a row's fields in one change.";
}

async function lessonProblem(db: TransactionClient, lessonId: string): Promise<string | null> {
  const lesson = await db.lesson.findUnique({
    select: { contentStatus: true, ownerId: true, visibility: true },
    where: { id: lessonId },
  });

  if (!lesson) {
    return `No Lesson with id ${lessonId}.`;
  }

  if (lesson.visibility === "private" || lesson.ownerId) {
    return PRIVATE_CONTENT;
  }

  if (lesson.contentStatus !== "completed") {
    return "Only a published lesson can be fixed; this one is still being written.";
  }

  return (await readStagedLessonVersion(lessonId, db))
    ? "A new version of this lesson is waiting to replace it; fix it once that version is published."
    : null;
}

function readBasis(content: unknown): { position: number; quote: string } | null {
  const basis = isJsonObject(content) ? content.basis : null;

  return isJsonObject(basis) &&
    typeof basis.position === "number" &&
    typeof basis.quote === "string"
    ? { position: basis.position, quote: basis.quote }
    : null;
}

/** A question shows the sentence of an earlier screen that decides it, so that sentence must stay. */
async function quoteProblem(
  db: TransactionClient,
  { contents, lessonId }: { contents: ReadonlyMap<string, Json>; lessonId: string },
): Promise<string | null> {
  if (contents.size === 0) {
    return null;
  }

  const steps = await db.step.findMany({
    select: { content: true, id: true, kind: true, position: true },
    where: { lessonId, ...CURRENT_STEPS },
  });

  const screens = steps.map((step) => ({
    ...step,
    content: contents.get(step.id) ?? step.content,
  }));

  const byPosition = new Map(screens.map((screen) => [screen.position, screen]));

  const broken = screens.find((screen) => {
    const basis = readBasis(screen.content);
    const reading = basis ? byPosition.get(basis.position) : undefined;

    if (!basis || (!contents.has(screen.id) && !(reading && contents.has(reading.id)))) {
      return false;
    }

    const texts = getScreenReadingTexts(reading);
    return !texts || !holdsQuote({ quote: basis.quote, texts });
  });

  const basis = broken ? readBasis(broken.content) : null;

  return broken && basis
    ? `The question on screen ${String(broken.position)} quotes "${basis.quote}", which screen ${String(basis.position)} would no longer say. Fix both screens together.`
    : null;
}

function screenContents(changes: readonly StoredChange[]): Map<string, Json> {
  return new Map(
    changes.flatMap((change) =>
      (change.op === "set" || change.op === "setOptions") && change.model === "Step"
        ? change.fields.map((field) => [change.id, field.after] as const)
        : [],
    ),
  );
}

function variantIds(changes: readonly StoredChange[]): string[] {
  return changes.filter((change) => change.model === "StepVariant").map((change) => change.id);
}

/** A screen's versions for a field or tool are rows of their own, which a fix sets or leaves. */
async function keptVariantEffects(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<ContentFixEffect[]> {
  const stepIds = [...screenContents(changes).keys()];

  if (stepIds.length === 0) {
    return [];
  }

  const kept = await db.stepVariant.findMany({
    select: { stepId: true },
    where: { id: { notIn: variantIds(changes) }, stepId: { in: stepIds } },
  });

  return stepIds.flatMap((stepId) => {
    const count = kept.filter((variant) => variant.stepId === stepId).length;
    return count > 0 ? [{ count, kind: "variantsKept" as const, stepId }] : [];
  });
}

function uniqueEffects(effects: readonly ContentFixEffect[]): ContentFixEffect[] {
  const seen = new Set<string>();

  return effects.filter((effect) => {
    const key = JSON.stringify(effect);
    const isNew = !seen.has(key);
    seen.add(key);
    return isNew;
  });
}

/** Applying a screen fix deletes that screen's answer explanations, so the same fix can't edit one. */
async function deletedExplanationProblem(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<string | null> {
  const explanationIds = changes
    .filter((change) => change.model === "AnswerExplanation")
    .map((change) => change.id);

  if (explanationIds.length === 0) {
    return null;
  }

  const itemIds = changes
    .filter((change) => change.op === "set" && change.model === "Item")
    .map((change) => change.id);

  const deleted = await db.answerExplanation.findFirst({
    select: { id: true },
    where: {
      OR: [
        { stepId: { in: [...screenContents(changes).keys()] } },
        { step: { variants: { some: { id: { in: variantIds(changes) } } } } },
        { itemId: { in: itemIds } },
      ],
      id: { in: explanationIds },
    },
  });

  return deleted
    ? `Fixing a screen or a question deletes its saved answer explanations, AnswerExplanation ${deleted.id} among them. Leave that change out; a new one is written from the fixed content.`
    : null;
}

async function optionsVariantProblem(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<string | null> {
  const steps = changes.filter((change) => change.model === "Step" && change.op === "setOptions");

  const changedVariants = await db.stepVariant.findMany({
    select: { stepId: true },
    where: {
      id: {
        in: changes
          .filter((change) => change.model === "StepVariant" && change.op === "setOptions")
          .map((change) => change.id),
      },
    },
  });

  const stepIds = [
    ...new Set([
      ...steps.map((step) => step.id),
      ...changedVariants.map((variant) => variant.stepId),
    ]),
  ];

  const variants = await db.stepVariant.findMany({
    select: { id: true },
    where: { stepId: { in: stepIds } },
  });

  const missing = variants.find(
    (variant) =>
      !changes.some(
        (change) =>
          change.model === "StepVariant" && change.op === "setOptions" && change.id === variant.id,
      ),
  );

  return missing
    ? `setOptions must include every variant; include StepVariant ${missing.id}.`
    : null;
}

async function unitProblem(
  db: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<string | null> {
  if (unit.kind === "item") {
    return deletedExplanationProblem(db, changes);
  }

  if (unit.kind !== "lesson") {
    return null;
  }

  return (
    (changes.every((change) => change.model === "Lesson" && change.op === "setSkills")
      ? null
      : await lessonProblem(db, unit.id)) ??
    (await optionsVariantProblem(db, changes)) ??
    (await deletedExplanationProblem(db, changes)) ??
    (await numericScreenProblem(db, changes)) ??
    quoteProblem(db, { contents: screenContents(changes), lessonId: unit.id })
  );
}

/**
 * Reads every row the changes touch and returns what the server will write: each field's value as
 * stored now and as fixed, and what applying it also does. Proposing and approving both run it, so
 * a rule added later applies to fixes already waiting.
 */
export async function prepareContentFix(
  db: TransactionClient,
  resolvers: readonly ChangeResolver[],
): Promise<Refusal | { fix: PreparedFix; ok: true }> {
  const resolved = await Promise.all(resolvers.map((resolve) => resolve(db)));
  const refused = resolved.find((change) => !change.ok);

  if (refused && !refused.ok) {
    return refused;
  }

  const accepted = resolved.filter((change) => change.ok);
  const [first] = accepted;
  const units = new Set(accepted.map((change) => `${change.unit.kind}:${change.unit.id}`));

  const chapterCollections = accepted.every((change) => {
    const stored = change.stored;
    return isJsonObject(stored) && stored.model === "Chapter" && stored.op === "setLessons";
  });

  if (!first || (units.size !== 1 && !chapterCollections)) {
    return refuse(
      "One fix covers one lesson (with its screens), one chapter, one course, one practice question or one level test. Split it into one fix each.",
    );
  }

  const stored = contentFixChangesSchema.parse(accepted.map((change) => change.stored));

  const problem =
    overlapProblem(stored) ?? (await unitProblem(db, { changes: stored, unit: first.unit }));

  if (problem) {
    return refuse(problem);
  }

  const lessonVersion: ContentFixEffect[] =
    first.unit.kind === "lesson" ? [{ kind: "lessonVersion", lessonId: first.unit.id }] : [];

  const effects = [
    ...lessonVersion,
    ...accepted.flatMap((change) => change.effects),
    ...(await keptVariantEffects(db, stored)),
  ];

  return { fix: { changes: stored, effects: uniqueEffects(effects), unit: first.unit }, ok: true };
}
