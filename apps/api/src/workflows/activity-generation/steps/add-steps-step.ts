import { type StepVisualKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type VisualWithUrl } from "./generate-visual-images-step";
import { type ActivityContext } from "./get-activity-step";

const VALID_VISUAL_KINDS: Record<StepVisualKind, true> = {
  audio: true,
  chart: true,
  code: true,
  diagram: true,
  image: true,
  quote: true,
  table: true,
  timeline: true,
  video: true,
};

function isValidVisualKind(kind: string): kind is StepVisualKind {
  return kind in VALID_VISUAL_KINDS;
}

function mapVisualKind(kind: string): StepVisualKind {
  return isValidVisualKind(kind) ? kind : "image";
}

function extractVisualContent(visual: VisualWithUrl) {
  const { kind: _kind, stepIndex: _stepIndex, ...rest } = visual;
  return rest;
}

export async function addStepsStep(input: {
  context: ActivityContext;
  steps: {
    title: string;
    text: string;
  }[];
  visuals: VisualWithUrl[];
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addSteps" });

  const stepsData = input.steps.map((step, index) => {
    const visual = input.visuals.find((item) => item.stepIndex === index);

    const baseData = {
      activityId: input.context.id,
      content: { text: step.text, title: step.title },
      kind: "static" as const,
      position: index,
    };

    if (!visual) {
      return baseData;
    }

    return {
      ...baseData,
      visualContent: extractVisualContent(visual),
      visualKind: mapVisualKind(visual.kind),
    };
  });

  const { error } = await safeAsync(() => prisma.step.createMany({ data: stepsData }));

  if (error) {
    await streamStatus({ status: "error", step: "addSteps" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addSteps" });
}
