import { generateAlternativeTitlesStep } from "../steps/generate-alternative-titles-step";
import { generateCategoriesStep } from "../steps/generate-categories-step";
import { generateChaptersStep } from "../steps/generate-chapters-step";
import { generateDescriptionStep } from "../steps/generate-description-step";
import { generateImageStep } from "../steps/generate-image-step";
import type {
  CourseContext,
  ExistingCourseContent,
  GeneratedChapter,
} from "../types";

export type GeneratedContent = {
  description: string;
  imageUrl: string;
  alternativeTitles: string[];
  categories: string[];
  chapters: GeneratedChapter[];
};

export async function generateMissingContent(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<GeneratedContent> {
  const [
    generatedDescription,
    generatedImageUrl,
    alternativeTitles,
    categories,
    chapters,
  ] = await Promise.all([
    existing.description ? null : generateDescriptionStep(course),
    existing.imageUrl ? null : generateImageStep(course),
    existing.hasAlternativeTitles ? [] : generateAlternativeTitlesStep(course),
    existing.hasCategories ? [] : generateCategoriesStep(course),
    existing.hasChapters ? [] : generateChaptersStep(course),
  ]);

  return {
    alternativeTitles,
    categories,
    chapters,
    description: existing.description || generatedDescription || "",
    imageUrl: existing.imageUrl || generatedImageUrl || "",
  };
}
