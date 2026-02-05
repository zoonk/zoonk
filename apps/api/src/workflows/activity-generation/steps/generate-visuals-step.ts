import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisual = StepVisualSchema["visuals"][number];

function isValidVisualContent(content: unknown): boolean {
  return content !== null && typeof content === "object" && Object.keys(content).length > 0;
}

function mapToStepVisual(
  step: {
    id: bigint;
    visualContent: unknown;
    visualKind: string | null;
  },
  index: number,
): StepVisual {
  const content = step.visualContent as Record<string, unknown>;
  return { ...content, kind: step.visualKind, stepIndex: index } as unknown as StepVisual;
}

export async function generateVisualsStep(
  activities: LessonActivity[],
  steps: ActivitySteps,
  activityKind: ActivityKind,
): Promise<{ visuals: StepVisual[] }> {
  "use step";

  const activity = activities.find((a) => a.kind === activityKind);

  if (!activity || steps.length === 0) {
    return { visuals: [] };
  }

  // Query current DB state for resume check
  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, visualContent: true, visualKind: true },
    where: { activityId: activity.id },
  });

  if (dbSteps.length === 0) {
    return { visuals: [] };
  }

  // Resume: ALL steps already have visuals
  if (dbSteps.every((s) => s.visualKind !== null && isValidVisualContent(s.visualContent))) {
    return { visuals: dbSteps.map(mapToStepVisual) };
  }

  await streamStatus({ status: "started", step: "generateVisuals" });

  // Generate ALL visuals (all-or-nothing)
  const { data: result, error } = await safeAsync(() =>
    generateStepVisuals({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      steps,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateVisuals" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { visuals: [] };
  }

  // Save ALL visuals to DB (all-or-nothing with Promise.all + safeAsync)
  const { error: saveError } = await safeAsync(() =>
    Promise.all(
      result.data.visuals.map((visual) => {
        const dbStep = dbSteps[visual.stepIndex];
        if (!dbStep) {
          return Promise.resolve();
        }
        const { stepIndex: _, kind: __, ...visualContent } = visual;
        return prisma.step.update({
          data: { visualContent, visualKind: visual.kind },
          where: { id: dbStep.id },
        });
      }),
    ),
  );

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    await streamStatus({ status: "error", step: "generateVisuals" });
    return { visuals: [] };
  }

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return { visuals: result.data.visuals };
}
