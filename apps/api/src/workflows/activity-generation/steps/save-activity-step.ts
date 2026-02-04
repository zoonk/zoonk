import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type StepVisualWithUrl } from "./generate-images-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsCompletedStep } from "./set-activity-as-completed-step";

export async function saveActivityStep(
  activities: LessonActivity[],
  steps: ActivitySteps,
  visuals: StepVisualWithUrl[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);

  if (!activity || steps.length === 0) {
    return;
  }

  if (activity.generationStatus === "completed") {
    return;
  }

  await streamStatus({ status: "started", step: "saveActivity" });

  const stepsData = steps.map((step, index) => {
    const visual = visuals.find((item) => item.stepIndex === index);

    const baseData = {
      activityId: activity.id,
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
      visualKind: kind,
    };
  });

  const { error } = await safeAsync(() => prisma.step.createMany({ data: stepsData }));

  if (error) {
    await streamStatus({ status: "error", step: "saveActivity" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await setActivityAsCompletedStep({ activityId: activity.id, workflowRunId });
  await streamStatus({ status: "completed", step: "saveActivity" });
}
