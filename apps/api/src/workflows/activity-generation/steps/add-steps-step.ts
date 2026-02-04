import { type StepVisualKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type VisualWithUrl } from "./generate-visual-images-step";
import { type ActivityContext } from "./get-activity-step";

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

    const { kind, stepIndex: _stepIndex, ...visualContent } = visual;

    return {
      ...baseData,
      visualContent,
      visualKind: kind as StepVisualKind,
    };
  });

  const { error } = await safeAsync(() => prisma.step.createMany({ data: stepsData }));

  if (error) {
    await streamStatus({ status: "error", step: "addSteps" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addSteps" });
}
