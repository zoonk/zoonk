import { generateAlternativeTitlesStep } from "../steps/generate-alternative-titles-step";
import { generateCategoriesStep } from "../steps/generate-categories-step";
import { generateChaptersStep } from "../steps/generate-chapters-step";
import { generateDescriptionStep } from "../steps/generate-description-step";
import { generateImageStep } from "../steps/generate-image-step";
import { streamStatus } from "../stream-status";
import { type CourseContext, type ExistingCourseContent, type GeneratedChapter } from "../types";

export type GeneratedContent = {
  description: string;
  imageUrl: string;
  alternativeTitles: string[];
  categories: string[];
  chapters: GeneratedChapter[];
};

async function descriptionOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string | null> {
  if (existing.description) {
    await streamStatus({ status: "completed", step: "generateDescription" });
    return null;
  }
  return generateDescriptionStep(course);
}

async function imageOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string | null> {
  if (existing.imageUrl) {
    await streamStatus({ status: "completed", step: "generateImage" });
    return null;
  }
  return generateImageStep(course);
}

async function altTitlesOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string[]> {
  if (existing.hasAlternativeTitles) {
    await streamStatus({ status: "completed", step: "generateAlternativeTitles" });
    return [];
  }
  return generateAlternativeTitlesStep(course);
}

async function categoriesOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string[]> {
  if (existing.hasCategories) {
    await streamStatus({ status: "completed", step: "generateCategories" });
    return [];
  }
  return generateCategoriesStep(course);
}

async function chaptersOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<GeneratedChapter[]> {
  if (existing.hasChapters) {
    await streamStatus({ status: "completed", step: "generateChapters" });
    return [];
  }
  return generateChaptersStep(course);
}

export async function generateMissingContent(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<GeneratedContent> {
  const [generatedDescription, generatedImageUrl, alternativeTitles, categories, chapters] =
    await Promise.all([
      descriptionOrSkip(course, existing),
      imageOrSkip(course, existing),
      altTitlesOrSkip(course, existing),
      categoriesOrSkip(course, existing),
      chaptersOrSkip(course, existing),
    ]);

  return {
    alternativeTitles,
    categories,
    chapters,
    description: existing.description || generatedDescription || "",
    imageUrl: existing.imageUrl || generatedImageUrl || "",
  };
}
