import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ExplanationActivityPlanEntry } from "./_utils/build-explanation-activity-plan";
import { handleActivityFailureStep } from "./handle-failure-step";

type StepCreateManyData = NonNullable<Parameters<typeof prisma.step.createMany>[0]>["data"];

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T extends (infer Item)[] ? Item : T;

type StepRecord = ArrayItem<StepCreateManyData>;

/**
 * Explanation activities have an explicit ordered plan with optional
 * visuals and inline predict checks. Saving directly from that plan keeps the
 * database order identical to the learner flow instead of rebuilding positions
 * from separate static and visual arrays.
 */
function buildExplanationStepRecords({
  activityId,
  plan,
  visuals,
}: {
  activityId: string;
  plan: ExplanationActivityPlanEntry[];
  visuals: Record<string, unknown>[];
}) {
  const visualContentByPosition = buildVisualContentByPosition({ plan, visuals });

  return plan.map((entry, position) =>
    buildExplanationStepRecord({
      activityId,
      entry,
      position,
      visualContentByPosition,
    }),
  );
}

/**
 * Explanation visuals are generated separately from the text plan, but the
 * database needs one exact ordered sequence. This helper reattaches each
 * generated visual to the visual slot it belongs to before any records are
 * created, so the save code stays simple and deterministic.
 */
function buildVisualContentByPosition({
  plan,
  visuals,
}: {
  plan: ExplanationActivityPlanEntry[];
  visuals: Record<string, unknown>[];
}) {
  const visualPositions = plan.flatMap((entry, position) =>
    entry.kind === "visual" ? [position] : [],
  );

  if (visualPositions.length !== visuals.length) {
    throw new Error("Generated visual count does not match explanation plan");
  }

  return new Map(
    visualPositions.map((position, index) => [position, getVisualContent({ index, visuals })]),
  );
}

/**
 * The visual generator returns raw payloads because the concrete shape depends
 * on the chosen visual kind. Validating each payload here gives the save step
 * one trusted visual type before we write anything to the database.
 */
function getVisualContent({
  index,
  visuals,
}: {
  index: number;
  visuals: Record<string, unknown>[];
}) {
  const visual = visuals[index];

  if (!visual) {
    throw new Error("Missing generated visual for explanation plan");
  }

  return assertStepContent("visual", visual);
}

/**
 * Every explanation plan entry becomes exactly one persisted step record. This
 * helper keeps the branching for static copy, predict checks, and visuals in
 * one place so the main save function reads like a straight pipeline.
 */
function buildExplanationStepRecord({
  activityId,
  entry,
  position,
  visualContentByPosition,
}: {
  activityId: string;
  entry: ExplanationActivityPlanEntry;
  position: number;
  visualContentByPosition: Map<number, StepRecord["content"]>;
}): StepRecord {
  if (entry.kind === "static") {
    return {
      activityId,
      content: assertStepContent("static", {
        text: entry.text,
        title: entry.title,
        variant: "text",
      }),
      isPublished: true,
      kind: "static" as const,
      position,
    };
  }

  if (entry.kind === "multipleChoice") {
    return {
      activityId,
      content: assertStepContent("multipleChoice", {
        kind: "core",
        options: entry.options,
        question: entry.question,
      }),
      isPublished: true,
      kind: "multipleChoice" as const,
      position,
    };
  }

  const visualContent = visualContentByPosition.get(position);

  if (!visualContent) {
    throw new Error("Missing generated visual for explanation plan");
  }

  return {
    activityId,
    content: visualContent,
    isPublished: true,
    kind: "visual" as const,
    position,
  };
}

/**
 * Persists the full explanation activity plan in one transaction and marks the
 * activity as completed. Upstream steps only produce structured data; this is
 * the single write point that turns that plan into real DB rows.
 */
export async function saveExplanationActivityStep({
  activityId,
  plan,
  visuals,
  workflowRunId,
}: {
  activityId: string;
  plan: ExplanationActivityPlanEntry[];
  visuals: Record<string, unknown>[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveExplanationActivity" });

  const { data: stepRecords, error: buildError } = await safeAsync(async () =>
    buildExplanationStepRecords({ activityId, plan, visuals }),
  );

  if (buildError || !stepRecords) {
    await stream.error({ reason: "dbSaveFailed", step: "saveExplanationActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: activityId },
      }),
    ]),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveExplanationActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveExplanationActivity" });
}
