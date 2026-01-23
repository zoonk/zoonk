import { createLessons } from "@/data/lessons/create-lessons";
import { streamStatus } from "../stream-status";
import { type GeneratedLesson } from "./generate-lessons-step";
import { type ChapterContext } from "./get-chapter-step";

type AddInput = {
  context: ChapterContext;
  lessons: GeneratedLesson[];
};

export async function addLessonsStep(input: AddInput): Promise<void> {
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
