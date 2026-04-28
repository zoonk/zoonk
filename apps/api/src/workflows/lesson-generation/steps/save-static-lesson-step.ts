import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { saveStaticLessonContent } from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

async function saveStaticLessonStep({
  context,
  images,
  step,
  steps,
}: {
  context: LessonContext;
  images: StepImage[];
  step: Extract<LessonStepName, "saveExplanationLesson" | "saveTutorialLesson">;
  steps: StaticLessonStep[];
}): Promise<void> {
  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step });

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await saveStaticLessonContent({ context, images, steps });

  await stream.status({ status: "completed", step });
}

export async function saveExplanationLessonStep({
  context,
  images,
  steps,
}: {
  context: LessonContext;
  images: StepImage[];
  steps: StaticLessonStep[];
}): Promise<void> {
  "use step";

  return saveStaticLessonStep({
    context,
    images,
    step: "saveExplanationLesson",
    steps,
  });
}

export async function saveTutorialLessonStep({
  context,
  images,
  steps,
}: {
  context: LessonContext;
  images: StepImage[];
  steps: StaticLessonStep[];
}): Promise<void> {
  "use step";

  return saveStaticLessonStep({
    context,
    images,
    step: "saveTutorialLesson",
    steps,
  });
}
