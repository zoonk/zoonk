type DbStep = { position: number };
type VisualWithStepIndex = { stepIndex: number };

type VisualRow<TVisual extends VisualWithStepIndex> = {
  activityId: bigint | number;
  content: Omit<TVisual, "stepIndex">;
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

export function buildVisualRows<TVisual extends VisualWithStepIndex>({
  activityId,
  dbSteps,
  visuals,
}: {
  activityId: bigint | number;
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
