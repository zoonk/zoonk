import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type prisma } from "@zoonk/db";
import { type ActivitySteps } from "./get-activity-steps";

type StepCreateManyData = NonNullable<Parameters<typeof prisma.step.createMany>[0]>["data"];

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T extends (infer Item)[] ? Item : T;

type StepRecord = ArrayItem<StepCreateManyData>;

/**
 * Explanation and custom activities now persist one readable step per concept,
 * with the generated illustration embedded in that same step. Building those
 * records through one helper keeps save steps aligned on ordering, validation,
 * and the exact static content shape.
 */
export function buildStaticStepRecords({
  activityId,
  images,
  steps,
}: {
  activityId: string;
  images: StepImage[];
  steps: ActivitySteps;
}): StepRecord[] {
  if (steps.length !== images.length) {
    throw new Error("Generated image count does not match step count");
  }

  return steps.map((step, position) => ({
    activityId,
    content: assertStepContent("static", {
      image: images[position],
      text: step.text,
      title: step.title,
      variant: "text",
    }),
    isPublished: true,
    kind: "static" as const,
    position,
  }));
}
