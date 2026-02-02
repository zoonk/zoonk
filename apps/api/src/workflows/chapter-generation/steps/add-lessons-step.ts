import { createLessons } from "@/data/lessons/create-lessons";
import { streamStatus } from "../stream-status";
import { type GeneratedLesson } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

export async function addLessonsStep(input: {
  context: ChapterContext;
  lessons: GeneratedLesson[];
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addLessons" });

  const { error } = await createLessons({
    chapterId: input.context.id,
    language: input.context.language,
    lessons: input.lessons,
    organizationId: input.context.organizationId,
  });

  if (error) {
    await streamStatus({ status: "error", step: "addLessons" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addLessons" });
}
