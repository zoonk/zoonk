import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type PracticeLessonContent } from "./_utils/generated-lesson-content";
import { savePracticeLessonContent } from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function savePracticeLessonStep({
  content,
  context,
  images,
}: {
  content: PracticeLessonContent;
  context: LessonContext;
  images: StepImage[];
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "savePracticeLesson" });

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await savePracticeLessonContent({ content, context, images });

  await stream.status({ status: "completed", step: "savePracticeLesson" });
}
