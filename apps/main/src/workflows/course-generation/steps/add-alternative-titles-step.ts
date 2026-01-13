import { addCourseAlternativeTitles } from "@/data/courses/add-course-alternative-titles";
import { streamStatus } from "../stream-status";
import type { CourseContext } from "../types";

type AddInput = {
  course: CourseContext;
  alternativeTitles: string[];
};

export async function addAlternativeTitlesStep(input: AddInput): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addAlternativeTitles" });

  const { error } = await addCourseAlternativeTitles({
    courseId: input.course.courseId,
    language: input.course.language,
    titles: input.alternativeTitles,
  });

  if (error) {
    await streamStatus({ status: "error", step: "addAlternativeTitles" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addAlternativeTitles" });
}
