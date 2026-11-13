import { isDeepStrictEqual } from "node:util";
import { type StepKind, type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { validateActivity } from "../../../library/activities/validate-activity";
import { normalizeStepContentValue } from "../../../library/steps/contract/normalize-step-content";
import {
  describeContentIssues,
  isRelationKind,
  safeParseStepContent,
} from "../../../library/steps/contract/step-contract";
import {
  type Json,
  NOT_CURRENT_SCREEN,
  type Resolution,
  refuse,
  toJson,
} from "../_utils/resolved-change";
import { type ContentFixEffect } from "../contract";
import { checkScreenContentChange } from "../screen-content-rules";
import {
  type FieldChange,
  defineFixHandler,
  fieldChangeSchema,
  fieldTargets,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

type ScreenModel = "Step" | "StepVariant";

type ContentStored<Model extends ScreenModel> = {
  fields: FieldChange[];
  id: string;
  model: Model;
  op: "set";
};

type ScreenRow = {
  itemId: string | null;
  kind: StepKind;
  lessonId: string;
  retiredAt: Date | null;
  sentenceId: string | null;
  staged: boolean;
  wordId: string | null;
};

export const screenSelect = {
  itemId: true,
  kind: true,
  lessonId: true,
  retiredAt: true,
  sentenceId: true,
  staged: true,
  wordId: true,
} as const;

/** A spoken screen copies its sentence; those fields change with the sentence, not the screen. */
const SENTENCE_FIELDS = ["romanization", "targetText", "translation"] as const;

function screenProblem(step: ScreenRow): string | null {
  if (step.retiredAt || step.staged) {
    return NOT_CURRENT_SCREEN;
  }

  if (isRelationKind(step.kind)) {
    const row = step.wordId ? `Word ${step.wordId}` : `Sentence ${step.sentenceId ?? ""}`;
    return `This screen shows ${row} and holds no text of its own; fix that row instead.`;
  }

  return null;
}

function copiedFieldProblem({
  after,
  before,
  step,
}: {
  after: Json;
  before: Json;
  step: ScreenRow;
}): string | null {
  if (!step.sentenceId || !isJsonObject(after) || !isJsonObject(before)) {
    return null;
  }

  const copied = SENTENCE_FIELDS.find((field) => !isDeepStrictEqual(after[field], before[field]));

  return copied
    ? `content.${copied} is copied from Sentence ${step.sentenceId}; fix the sentence instead.`
    : null;
}

function contentProblem({ content, kind }: { content: Json; kind: StepKind }): string | null {
  const parsed = safeParseStepContent(kind, content);

  if (!parsed.success) {
    return `content doesn't fit a ${kind} screen: ${describeContentIssues(parsed.error).join("; ")}`;
  }

  if (kind !== "activity") {
    return null;
  }

  const activity = validateActivity(parsed.data);

  return activity.ok
    ? null
    : `content isn't a valid activity: ${activity.issues.map((issue) => issue.message).join("; ")}`;
}

function onlyContent(set: Record<string, Json>, model: ScreenModel) {
  const fields = Object.keys(set);

  return fields.length === 1 && fields[0] === "content"
    ? null
    : `A ${model} fix sets only content, the whole screen as JSON.`;
}

function resolveContent<Model extends ScreenModel>({
  after: sent,
  before,
  id,
  model,
  step,
}: {
  after: Json;
  before: Json;
  id: string;
  model: Model;
  step: ScreenRow;
}): Resolution<ContentStored<Model>> {
  const after = toJson(normalizeStepContentValue(sent));
  const invalid = contentProblem({ content: after, kind: step.kind });

  if (invalid) {
    return refuse(invalid);
  }

  const copied = copiedFieldProblem({ after, before, step });

  if (copied) {
    return refuse(copied);
  }

  const keyedElsewhere = model === "Step" && step.itemId !== null;
  const verdict = checkScreenContentChange({ after, before, keyedElsewhere, kind: step.kind });

  if (!verdict.ok) {
    return refuse(`content: ${verdict.problem}`);
  }

  if (isDeepStrictEqual(after, before)) {
    return refuse(`${model} ${id} already has this content.`);
  }

  const effects: ContentFixEffect[] = [
    !keyedElsewhere && verdict.changesAnswerKey && { id, kind: "answerKeyChanged" as const, model },
    !keyedElsewhere && verdict.changesQuestion && { id, kind: "questionChanged" as const, model },
    { kind: "marksKept" as const, lessonId: step.lessonId },
  ].filter((effect) => effect !== false);

  return {
    effects,
    ok: true,
    stored: { fields: [{ after, before, field: "content" }], id, model, op: "set" },
    unit: { id: step.lessonId, kind: "lesson" },
  };
}

/** What a screen fix deletes: answers explained and tutor answers shared, written from the old screen. */
export async function writtenFromScreen(db: TransactionClient, stepId: string) {
  const [explanations, tutorAnswers] = await Promise.all([
    db.answerExplanation.count({ where: { stepId } }),
    db.tutorSharedAnswer.count({ where: { stepId } }),
  ]);

  return [
    ...(explanations > 0
      ? [{ count: explanations, kind: "answerExplanationsDeleted" as const, stepId }]
      : []),
    ...(tutorAnswers > 0
      ? [{ count: tutorAnswers, kind: "tutorAnswersDeleted" as const, stepId }]
      : []),
  ];
}

export async function deleteWrittenFromScreen(
  tx: TransactionClient,
  stepId: string,
): Promise<void> {
  await tx.answerExplanation.deleteMany({ where: { stepId } });
  await tx.tutorSharedAnswer.deleteMany({ where: { stepId } });
}

async function withWrittenFromScreen<Stored>(
  db: TransactionClient,
  { resolved, stepId }: { resolved: Resolution<Stored>; stepId: string },
): Promise<Resolution<Stored>> {
  return resolved.ok
    ? { ...resolved, effects: [...resolved.effects, ...(await writtenFromScreen(db, stepId))] }
    : resolved;
}

async function resolveStepContent(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<Resolution<ContentStored<"Step">>> {
  const fieldIssue = onlyContent(set, "Step");

  if (fieldIssue) {
    return refuse(fieldIssue);
  }

  const step = await db.step.findUnique({
    select: { ...screenSelect, content: true },
    where: { id },
  });

  if (!step) {
    return refuse(`No Step with id ${id}.`);
  }

  const problem = screenProblem(step);

  if (problem) {
    return refuse(problem);
  }

  const resolved = resolveContent({
    after: set.content ?? null,
    before: toJson(step.content),
    id,
    model: "Step",
    step,
  });

  return withWrittenFromScreen(db, { resolved, stepId: id });
}

async function resolveVariantContent(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<Resolution<ContentStored<"StepVariant">>> {
  const fieldIssue = onlyContent(set, "StepVariant");

  if (fieldIssue) {
    return refuse(fieldIssue);
  }

  const variant = await db.stepVariant.findUnique({
    select: { content: true, step: { select: screenSelect }, stepId: true },
    where: { id },
  });

  if (!variant) {
    return refuse(`No StepVariant with id ${id}.`);
  }

  const problem = screenProblem(variant.step);

  if (problem) {
    return refuse(problem);
  }

  const resolved = resolveContent({
    after: set.content ?? null,
    before: toJson(variant.content),
    id,
    model: "StepVariant",
    step: variant.step,
  });

  return withWrittenFromScreen(db, { resolved, stepId: variant.stepId });
}

function contentOf(fields: readonly FieldChange[]) {
  const content = fields.find((field) => field.field === "content")?.after;

  if (!isJsonObject(content)) {
    throw new Error("A screen fix holds no content object");
  }

  return content;
}

const contentStored = <Model extends ScreenModel>(model: Model) =>
  z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal(model),
    op: z.literal("set"),
  });

const SCREEN_RULES =
  "A current screen of a published lesson, of any kind; send the whole content. It keeps its fields, ids, option count and order, references and picture requests, and changes what learners read before answering or which answer is right, never both, except a language exercise's words (fillBlank, multipleChoice, matchColumns…), which may change together. A screen with a numeric practice question (itemId) changes in the same fix as that Item, as the question draws it. A spoken screen's sentence fields and a word or sentence screen change with their Word or Sentence. Its variants (StepVariant) can be set in the same fix; the ones left out keep their content. Its saved answer explanations and shared tutor answers are deleted. A learner who started the lesson before the fix is never marked wrong for it.";

export const stepSet = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.step.update({ data: { content: contentOf(stored.fields) }, where: { id: stored.id } });
    await deleteWrittenFromScreen(tx, stored.id);
  },
  model: "Step",
  op: "set",
  proposal: {
    fields: ["content"],
    rules: SCREEN_RULES,
    schema: z.strictObject({ id: idSchema, model: z.literal("Step"), set: setFieldsSchema }),
  },
  resolve: (db, proposed) => resolveStepContent(db, proposed),
  revert: (db, stored) => resolveStepContent(db, toRevertedSet(stored)),
  stored: contentStored("Step"),
  table: sql`library_steps`,
  targets: (stored) => fieldTargets(stored),
  toProposed: (stored) => toSetProposal(stored),
});

export const variantSet = defineFixHandler({
  apply: async (tx, stored) => {
    const { stepId } = await tx.stepVariant.update({
      data: { content: contentOf(stored.fields) },
      select: { stepId: true },
      where: { id: stored.id },
    });

    await deleteWrittenFromScreen(tx, stepId);
  },
  model: "StepVariant",
  op: "set",
  proposal: {
    fields: ["content"],
    rules: "Same rules as its screen's content.",
    schema: z.strictObject({ id: idSchema, model: z.literal("StepVariant"), set: setFieldsSchema }),
  },
  resolve: (db, proposed) => resolveVariantContent(db, proposed),
  revert: (db, stored) => resolveVariantContent(db, toRevertedSet(stored)),
  stored: contentStored("StepVariant"),
  table: sql`step_variants`,
  targets: (stored) => fieldTargets(stored),
  toProposed: (stored) => toSetProposal(stored),
});
