import { isDeepStrictEqual } from "node:util";
import { type StepKind, type TransactionClient } from "@zoonk/db";
import { shouldOmitNumberedPicture } from "../../../lesson-player/picture-policy";
import { validateActivity } from "../../../library/activities/validate-activity";
import { normalizeStepContentValue } from "../../../library/steps/contract/normalize-step-content";
import {
  describeContentIssues,
  safeParseStepContent,
} from "../../../library/steps/contract/step-contract";
import { isExerciseKind } from "../../../player/contracts/exercise-content";
import { type ContentFixEffect } from "../contract";
import { checkScreenContentChange } from "../screen-content-rules";
import {
  type Json,
  NOT_CURRENT_SCREEN,
  type ResolvedChange,
  refuse,
  toJson,
} from "./resolved-change";

type ScreenRow = {
  itemId: string | null;
  kind: StepKind;
  lessonId: string;
  retiredAt: Date | null;
  sentenceId: string | null;
  staged: boolean;
  wordId: string | null;
};

const screenSelect = {
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

function onlyContent(set: Record<string, Json>, model: "Step" | "StepVariant") {
  const fields = Object.keys(set);

  return fields.length === 1 && fields[0] === "content"
    ? null
    : `A ${model} fix sets only content, the whole screen as JSON.`;
}

function resolveContent({
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
  model: "Step" | "StepVariant";
}): ResolvedChange {
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

export async function resolveStepContent(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<ResolvedChange> {
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

export async function resolveVariantContent(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<ResolvedChange> {
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

/** Takes the picture off this screen alone; the drawing and its other screens keep it. */
export async function resolvePictureDetach(
  db: TransactionClient,
  id: string,
): Promise<ResolvedChange> {
  const step = await db.step.findUnique({
    select: { ...screenSelect, content: true, mediaAssetId: true },
    where: { id },
  });

  if (!step) {
    return refuse(`No Step with id ${id}.`);
  }

  if (step.retiredAt || step.staged) {
    return refuse(NOT_CURRENT_SCREEN);
  }

  if (!step.mediaAssetId) {
    return refuse("This screen shows no picture to detach.");
  }

  const leftOut = shouldOmitNumberedPicture({
    content: step.content,
    imageAvailable: false,
    imagePending: false,
    kind: step.kind,
  });

  return {
    effects: leftOut ? [{ kind: "screenLeftOut", stepId: id }] : [],
    ok: true,
    stored: { id, mediaAssetId: step.mediaAssetId, model: "Step", op: "detachPicture" },
    unit: { id: step.lessonId, kind: "lesson" },
  };
}

/** Reverts a detached picture: the same drawing goes back while the screen still has none. */
export async function resolvePictureAttach(
  db: TransactionClient,
  { id, mediaAssetId }: { id: string; mediaAssetId: string },
): Promise<ResolvedChange> {
  const [step, asset] = await Promise.all([
    db.step.findUnique({
      select: { ...screenSelect, mediaAssetId: true, pictureRemovedAt: true },
      where: { id },
    }),
    db.mediaAsset.findUnique({ select: { visibility: true }, where: { id: mediaAssetId } }),
  ]);

  if (!step) {
    return refuse(`No Step with id ${id}.`);
  }

  if (step.retiredAt || step.staged) {
    return refuse(NOT_CURRENT_SCREEN);
  }

  if (step.mediaAssetId || !step.pictureRemovedAt) {
    return refuse("This screen's picture is no longer detached.");
  }

  if (asset?.visibility !== "public") {
    return refuse("The picture this screen showed no longer exists.");
  }

  return {
    effects: [],
    ok: true,
    stored: {
      id,
      mediaAssetId,
      model: "Step",
      op: "attachPicture",
      pictureRemovedAt: step.pictureRemovedAt.toISOString(),
    },
    unit: { id: step.lessonId, kind: "lesson" },
  };
}
