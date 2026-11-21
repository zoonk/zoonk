import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { runLessonQualityGate } from "@zoonk/core/library/quality/gate";
import { repairWrittenLesson } from "@zoonk/core/library/quality/repairs";

export async function lessonBlockingProblems({
  context,
  output,
}: {
  context: WriteLessonDraftParams;
  output: string;
}) {
  const lesson = repairWrittenLesson({
    language: context.language,
    lesson: JSON.parse(output) as WrittenLesson,
    spec: context.spec,
  });

  const gate = await runLessonQualityGate({ context, lesson, review: false, writerModel: "" });

  return [
    ...new Set(
      gate.blocking.map(({ problem, screen }) =>
        screen === null ? problem : `Screen ${screen + 1}: ${problem}`,
      ),
    ),
  ];
}
