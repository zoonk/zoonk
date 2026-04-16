type DbStep = { position: number };

type VisualWithStepIndex = { stepIndex: number };

/**
 * A database-ready row for a visual step. Contains the visual content
 * (without stepIndex) and the computed position for database insertion.
 */
type VisualRow<TVisual extends VisualWithStepIndex> = {
  activityId: string;
  content: Omit<TVisual, "stepIndex">;
  isPublished: true;
  kind: "visual";
  position: number;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Concrete (non-generic) visual step row for use by save steps and
 * workflow orchestration where the exact content shape doesn't matter —
 * it's stored as JSON in the database.
 */
export type VisualStepRow = {
  activityId: string;
  content: Record<string, JsonValue>;
  isPublished: true;
  kind: "visual";
  position: number;
};

function hasExpectedVisualCount(visuals: VisualWithStepIndex[], stepCount: number): boolean {
  return visuals.length === stepCount;
}

function hasNoVisuals(visuals: VisualWithStepIndex[]): boolean {
  return visuals.length === 0;
}

function hasValidStepIndex(stepIndex: number, stepCount: number): boolean {
  return Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepCount;
}

function hasInRangeStepIndexes(visuals: VisualWithStepIndex[], stepCount: number): boolean {
  return visuals.every((visual) => hasValidStepIndex(visual.stepIndex, stepCount));
}

function hasUniqueStepIndexes(visuals: VisualWithStepIndex[]): boolean {
  return new Set(visuals.map((visual) => visual.stepIndex)).size === visuals.length;
}

function hasValidVisualCoverage(visuals: VisualWithStepIndex[], stepCount: number): boolean {
  if (hasNoVisuals(visuals)) {
    return true;
  }

  if (!hasExpectedVisualCount(visuals, stepCount)) {
    return false;
  }

  if (!hasInRangeStepIndexes(visuals, stepCount)) {
    return false;
  }

  return hasUniqueStepIndexes(visuals);
}

function getDbStepOrThrow(dbSteps: DbStep[], stepIndex: number): DbStep {
  const dbStep = dbSteps[stepIndex];

  if (!dbStep) {
    throw new Error("Visual coverage validation is out of sync with DB steps");
  }

  return dbStep;
}

/**
 * Computes virtual "dbSteps" from the content step count.
 * Content steps are saved at positions `index * 2` (even positions),
 * so we recreate that mapping without reading the database.
 * Visual steps will be placed at `contentPosition + 1` (odd positions).
 */
function computeContentStepPositions(stepCount: number): DbStep[] {
  return Array.from({ length: stepCount }, (_, i) => ({ position: i * 2 }));
}

/**
 * Takes dispatched visual content (an ordered array from `dispatchVisualContent`),
 * adds `stepIndex` to each item, computes content step positions, and builds
 * database-ready visual rows. This is the shared pipeline used by both
 * explanation and custom visual content steps.
 *
 * Throws if the visual count doesn't match the description count.
 */
export function buildVisualStepRows({
  activityId,
  visuals,
}: {
  activityId: string;
  visuals: Record<string, unknown>[];
}): VisualStepRow[] {
  const visualsWithIndex = visuals.map((visual, index) => ({ ...visual, stepIndex: index }));
  const dbSteps = computeContentStepPositions(visuals.length);

  const rows = buildVisualRows({ activityId, dbSteps, visuals: visualsWithIndex });

  if (!rows) {
    throw new Error("Invalid visual coverage — visuals don't match content step count");
  }

  return rows;
}

function buildVisualRows<TVisual extends VisualWithStepIndex>({
  activityId,
  dbSteps,
  visuals,
}: {
  activityId: string;
  dbSteps: DbStep[];
  visuals: TVisual[];
}): VisualRow<TVisual>[] | null {
  if (!hasValidVisualCoverage(visuals, dbSteps.length)) {
    return null;
  }

  return visuals.map((visual) => {
    const dbStep = getDbStepOrThrow(dbSteps, visual.stepIndex);
    const { stepIndex: _, ...content } = visual;

    return {
      activityId,
      content,
      isPublished: true,
      kind: "visual" as const,
      position: dbStep.position + 1,
    };
  });
}
