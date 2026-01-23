import { addAlternativeTitlesStep } from "../steps/add-alternative-titles-step";
import { addCategoriesStep } from "../steps/add-categories-step";
import { addChaptersStep } from "../steps/add-chapters-step";
import { updateCourseStep } from "../steps/update-course-step";
import type {
  CourseContext,
  CreatedChapter,
  ExistingCourseContent,
} from "../types";
import type { GeneratedContent } from "./generate-missing-content";

export async function persistGeneratedContent(
  course: CourseContext,
  content: GeneratedContent,
  existing: ExistingCourseContent,
): Promise<CreatedChapter[]> {
  const needsCourseUpdate = !(existing.description && existing.imageUrl);

  const needsAlternativeTitles =
    !existing.hasAlternativeTitles && content.alternativeTitles.length > 0;

  const needsCategories =
    !existing.hasCategories && content.categories.length > 0;

  const needsChapters = !existing.hasChapters && content.chapters.length > 0;

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
    needsCategories &&
      addCategoriesStep({ categories: content.categories, course }),
  ].filter(Boolean);

  const [chapters] = await Promise.all([
    needsChapters
      ? addChaptersStep({ chapters: content.chapters, course })
      : Promise.resolve<CreatedChapter[]>([]),
    ...metadataOps,
  ]);

  return chapters;
}
