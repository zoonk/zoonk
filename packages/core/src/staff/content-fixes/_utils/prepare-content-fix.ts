import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { CURRENT_STEPS, readStagedLessonVersion } from "../../../library/lessons/lesson-versions";
import { getScreenReadingTexts, holdsQuote } from "../../../library/steps/question-bases";
import { type ContentFixEffect, type ProposedChange, type StoredChange } from "../contract";
import { resolveExplanation, resolveItemRestore, resolveItemRetire } from "./resolve-practice";
import {
  resolvePictureAttach,
  resolvePictureDetach,
  resolveStepContent,
  resolveVariantContent,
} from "./resolve-screen";
import { resolveTextRow } from "./resolve-text-row";
import {
  type FixUnit,
  type Json,
  PRIVATE_CONTENT,
  type Refusal,
  type ResolvedChange,
  refuse,
} from "./resolved-change";

export type PreparedFix = { changes: StoredChange[]; effects: ContentFixEffect[]; unit: FixUnit };

function resolveChange(db: TransactionClient, change: ProposedChange): Promise<ResolvedChange> {
  if ("retire" in change) {
    return resolveItemRetire(db, change.id);
  }

  if ("unretire" in change) {
    return resolveItemRestore(db, change.id);
  }

  if ("detachPicture" in change) {
    return resolvePictureDetach(db, change.id);
  }

  if ("attachPicture" in change) {
    return resolvePictureAttach(db, { id: change.id, mediaAssetId: change.attachPicture });
  }

  if (change.model === "Step") {
    return resolveStepContent(db, change);
  }

  if (change.model === "StepVariant") {
    return resolveVariantContent(db, change);
  }

  if (change.model === "AnswerExplanation") {
    return resolveExplanation(db, change);
  }

  return resolveTextRow(db, { id: change.id, model: change.model, set: change.set });
}

function changeKey(change: ProposedChange): string {
  const part = "detachPicture" in change || "attachPicture" in change ? "picture" : "fields";
  return `${change.model}:${change.id}:${part}`;
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
      change.op === "set" && change.model === "Step"
        ? change.fields.map((field) => [change.id, field.after] as const)
        : [],
    ),
  );
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

  const deleted = await db.answerExplanation.findFirst({
    select: { id: true },
    where: { id: { in: explanationIds }, stepId: { in: [...screenContents(changes).keys()] } },
  });

  return deleted
    ? `Fixing a screen deletes its saved answer explanations, AnswerExplanation ${deleted.id} among them. Leave that change out; a new one is written from the fixed screen.`
    : null;
}

async function unitProblem(
  db: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<string | null> {
  if (unit.kind !== "lesson") {
    return null;
  }

  return (
    (await lessonProblem(db, unit.id)) ??
    (await deletedExplanationProblem(db, changes)) ??
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
  changes: readonly ProposedChange[],
): Promise<Refusal | { fix: PreparedFix; ok: true }> {
  const keys = changes.map((change) => changeKey(change));

  if (new Set(keys).size !== keys.length) {
    return refuse("Each row appears once in a fix; put all of a row's fields in one change.");
  }

  const resolved = await Promise.all(changes.map((change) => resolveChange(db, change)));
  const refused = resolved.find((change) => !change.ok);

  if (refused && !refused.ok) {
    return refused;
  }

  const accepted = resolved.filter((change) => change.ok);
  const [first] = accepted;
  const units = new Set(accepted.map((change) => `${change.unit.kind}:${change.unit.id}`));

  if (!first || units.size !== 1) {
    return refuse(
      "One fix covers one lesson (with its screens), one chapter, one course or one practice question. Split it into one fix each.",
    );
  }

  const stored = accepted.map((change) => change.stored);
  const problem = await unitProblem(db, { changes: stored, unit: first.unit });

  if (problem) {
    return refuse(problem);
  }

  const lessonVersion: ContentFixEffect[] =
    first.unit.kind === "lesson" ? [{ kind: "lessonVersion", lessonId: first.unit.id }] : [];

  return {
    fix: {
      changes: stored,
      effects: uniqueEffects([...lessonVersion, ...accepted.flatMap((change) => change.effects)]),
      unit: first.unit,
    },
    ok: true,
  };
}

export function toProposedChanges(changes: readonly StoredChange[]): ProposedChange[] {
  return changes.map((change): ProposedChange => {
    if (change.op === "retire") {
      return { id: change.id, model: "Item", retire: true };
    }

    if (change.op === "unretire") {
      return { id: change.id, model: "Item", unretire: true };
    }

    if (change.op === "detachPicture") {
      return { detachPicture: true, id: change.id, model: "Step" };
    }

    if (change.op === "attachPicture") {
      return { attachPicture: change.mediaAssetId, id: change.id, model: "Step" };
    }

    return {
      id: change.id,
      model: change.model,
      set: Object.fromEntries(change.fields.map((field) => [field.field, field.after])),
    };
  });
}
