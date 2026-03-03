import { type Chapter } from "@zoonk/db";
import { addAlternativeTitlesStep } from "../steps/add-alternative-titles-step";
import { addCategoriesStep } from "../steps/add-categories-step";
import { addChaptersStep } from "../steps/add-chapters-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { updateCourseStep } from "../steps/update-course-step";
import { streamStatus } from "../stream-status";
import { type GeneratedContent } from "./generate-missing-content";
import { type ExistingCourseContent } from "./get-or-create-course";

async function emitSkippedPersistSteps(
  needsCourseUpdate: boolean,
  needsAlternativeTitles: boolean,
  needsCategories: boolean,
  needsChapters: boolean,
) {
  if (!needsCourseUpdate) {
    await streamStatus({ status: "completed", step: "updateCourse" });
  }
  if (!needsAlternativeTitles) {
    await streamStatus({ status: "completed", step: "addAlternativeTitles" });
  }
  if (!needsCategories) {
    await streamStatus({ status: "completed", step: "addCategories" });
  }
  if (!needsChapters) {
    await streamStatus({ status: "completed", step: "addChapters" });
  }
}

export async function persistGeneratedContent(
  course: CourseContext,
  content: GeneratedContent,
  existing: ExistingCourseContent,
): Promise<Chapter[]> {
  const needsCourseUpdate = !(existing.description && existing.imageUrl);

  const needsAlternativeTitles =
    !existing.hasAlternativeTitles && content.alternativeTitles.length > 0;

  const needsCategories = !existing.hasCategories && content.categories.length > 0;

  const needsChapters = !existing.hasChapters && content.chapters.length > 0;

  await emitSkippedPersistSteps(
    needsCourseUpdate,
    needsAlternativeTitles,
    needsCategories,
    needsChapters,
  );

  const metadataOps = [
    needsCourseUpdate &&
      updateCourseStep({
        course,
        description: content.description,
        imageUrl: content.imageUrl,
      }),
    needsAlternativeTitles &&
      addAlternativeTitlesStep({
        alternativeTitles: content.alternativeTitles,
        course,
      }),
    needsCategories && addCategoriesStep({ categories: content.categories, course }),
  ].filter(Boolean);

  const [chapters] = await Promise.all([
    needsChapters
      ? addChaptersStep({ chapters: content.chapters, course })
      : Promise.resolve<Chapter[]>([]),
    ...metadataOps,
  ]);

  return chapters;
}
