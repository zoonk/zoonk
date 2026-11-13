import { isDeepStrictEqual } from "node:util";
import { type StepKind, type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { validateActivity } from "../../../library/activities/validate-activity";
import { normalizeStepContentValue } from "../../../library/steps/contract/normalize-step-content";
import {
  describeContentIssues,
  safeParseStepContent,
} from "../../../library/steps/contract/step-contract";
import { isExerciseKind } from "../../../player/contracts/exercise-content";
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

function screenProblem(step: ScreenRow): string | null {
  if (step.retiredAt || step.staged) {
    return NOT_CURRENT_SCREEN;
  }

  if (step.itemId) {
    return "This screen's numeric question is also in the practice bank; fixing it is a later phase.";
  }

  if (step.wordId || step.sentenceId || isExerciseKind(step.kind)) {
    return "Language screens come from the lesson's words and sentences; fixing them is a later phase.";
  }

  return null;
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
  kind,
  lessonId,
  model,
}: {
  after: Json;
  before: Json;
  id: string;
  kind: StepKind;
  lessonId: string;
  model: Model;
}): Resolution<ContentStored<Model>> {
  const after = toJson(normalizeStepContentValue(sent));
  const invalid = contentProblem({ content: after, kind });

  if (invalid) {
    return refuse(invalid);
  }

  const verdict = checkScreenContentChange({ after, before, kind });

  if (!verdict.ok) {
    return refuse(`content: ${verdict.problem}`);
  }

  if (isDeepStrictEqual(after, before)) {
    return refuse(`${model} ${id} already has this content.`);
  }

  const effects: ContentFixEffect[] = [
    verdict.changesAnswerKey && { id, kind: "answerKeyChanged" as const, model },
    verdict.changesQuestion && { id, kind: "questionChanged" as const, model },
    { kind: "marksKept" as const, lessonId },
  ].filter((effect) => effect !== false);

  return {
    effects,
    ok: true,
    stored: { fields: [{ after, before, field: "content" }], id, model, op: "set" },
    unit: { id: lessonId, kind: "lesson" },
  };
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
    kind: step.kind,
    lessonId: step.lessonId,
    model: "Step",
  });

  if (!resolved.ok) {
    return resolved;
  }

  const explanations = await db.answerExplanation.count({ where: { stepId: id } });

  return {
    ...resolved,
    effects: [
      ...resolved.effects,
      ...(explanations > 0
        ? [{ count: explanations, kind: "answerExplanationsDeleted" as const, stepId: id }]
        : []),
    ],
  };
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
    select: { content: true, step: { select: screenSelect } },
    where: { id },
  });

  if (!variant) {
    return refuse(`No StepVariant with id ${id}.`);
  }

  const problem = screenProblem(variant.step);

  if (problem) {
    return refuse(problem);
  }

  return resolveContent({
    after: set.content ?? null,
    before: toJson(variant.content),
    id,
    kind: variant.step.kind,
    lessonId: variant.step.lessonId,
    model: "StepVariant",
  });
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
  "A current screen of a published lesson; send the whole content. It keeps its fields, ids, option count and order, references and picture requests, and changes what learners read before answering or which answer is right, never both. Its saved answer explanations are deleted. Language screens and screens with a numeric practice question can't be fixed yet.";

export const stepSet = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.step.update({ data: { content: contentOf(stored.fields) }, where: { id: stored.id } });
    await tx.answerExplanation.deleteMany({ where: { stepId: stored.id } });
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
    await tx.stepVariant.update({
      data: { content: contentOf(stored.fields) },
      where: { id: stored.id },
    });
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
