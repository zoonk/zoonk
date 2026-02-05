import { type StepVisualSchema, generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type StepVisual = StepVisualSchema["visuals"][number];

function isValidVisualContent(content: unknown): boolean {
  return isJsonObject(content) && Object.keys(content).length > 0;
}

function mapToStepVisual(
  step: {
    id: bigint;
    visualContent: unknown;
    visualKind: string | null;
  },
  index: number,
): StepVisual {
  const content = isJsonObject(step.visualContent) ? step.visualContent : {};
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reconstructing StepVisual union from DB fields; shape validated by isValidVisualContent guard
  return { ...content, kind: step.visualKind, stepIndex: index } as StepVisual;
}

async function getDbStepsForResume(activityId: bigint): Promise<{
  dbSteps: { id: bigint; visualContent: unknown; visualKind: string | null }[];
  existingVisuals: StepVisual[] | null;
}> {
  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, visualContent: true, visualKind: true },
    where: { activityId },
  });

  if (dbSteps.length === 0) {
    return { dbSteps: [], existingVisuals: null };
  }

  const allHaveVisuals = dbSteps.every(
    (step) => step.visualKind !== null && isValidVisualContent(step.visualContent),
  );

  if (allHaveVisuals) {
    return {
      dbSteps,
      existingVisuals: dbSteps.map((step, index) => mapToStepVisual(step, index)),
    };
  }

  return { dbSteps, existingVisuals: null };
}

async function saveVisualsToDB(
  visuals: StepVisual[],
  dbSteps: { id: bigint }[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    Promise.all(
      visuals.map((visual) => {
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
}

export async function generateVisualsStep(
  activities: LessonActivity[],
  steps: ActivitySteps,
  activityKind: ActivityKind,
): Promise<{ visuals: StepVisual[] }> {
  "use step";

  const activity = activities.find((act) => act.kind === activityKind);

  if (!activity || steps.length === 0) {
    return { visuals: [] };
  }

  const { dbSteps, existingVisuals } = await getDbStepsForResume(activity.id);

  if (dbSteps.length === 0 || existingVisuals) {
    return { visuals: existingVisuals ?? [] };
  }

  await streamStatus({ status: "started", step: "generateVisuals" });

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

  const { error: saveError } = await saveVisualsToDB(result.data.visuals, dbSteps);

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    await streamStatus({ status: "error", step: "generateVisuals" });
    return { visuals: [] };
  }

  await streamStatus({ status: "completed", step: "generateVisuals" });

  return { visuals: result.data.visuals };
}
