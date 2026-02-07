import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { prisma } from "@zoonk/db";
import { getString, toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { type CustomVisualResult } from "./generate-custom-visuals-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

async function generateImagesForActivity(activity: LessonActivity): Promise<void> {
  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return;
  }

  const dbSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, visualContent: true, visualKind: true },
    where: { activityId: activity.id },
  });

  const imageSteps = dbSteps.filter((step) => step.visualKind === "image");

  if (imageSteps.length === 0) {
    return;
  }

  const orgSlug = activity.lesson.chapter.course.organization.slug;

  const results = await Promise.allSettled(
    imageSteps.map((step) => {
      const prompt = getString(step.visualContent, "prompt");
      if (!prompt) {
        return Promise.reject(new Error("Missing prompt"));
      }
      return generateVisualStepImage({ orgSlug, prompt });
    }),
  );

  const updateResults = await Promise.allSettled(
    imageSteps.map((step, idx) => {
      const result = results[idx];
      if (result?.status !== "fulfilled" || result.value.error) {
        return Promise.resolve();
      }
      return prisma.step.update({
        data: { visualContent: { ...toRecord(step.visualContent), url: result.value.data } },
        where: { id: step.id },
      });
    }),
  );

  const hadFailure =
    results.some((result) => result.status === "rejected" || result.value.error) ||
    updateResults.some((result) => result.status === "rejected");

  if (hadFailure) {
    await handleActivityFailureStep({ activityId: activity.id });
  }
}

export async function generateCustomImagesStep(
  activities: LessonActivity[],
  customVisualResults: CustomVisualResult[],
): Promise<void> {
  "use step";

  if (customVisualResults.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "generateImages" });

  const activityIds = new Set(customVisualResults.map((result) => result.activityId));
  const customActivities = activities.filter((act) => activityIds.has(act.id));

  await Promise.allSettled(customActivities.map((act) => generateImagesForActivity(act)));

  await streamStatus({ status: "completed", step: "generateImages" });
}
