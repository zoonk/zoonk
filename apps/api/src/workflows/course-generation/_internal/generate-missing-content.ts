import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import { generateAlternativeTitlesStep } from "../steps/generate-alternative-titles-step";
import { generateCategoriesStep } from "../steps/generate-categories-step";
import { generateChaptersStep } from "../steps/generate-chapters-step";
import { generateDescriptionStep } from "../steps/generate-description-step";
import { generateImageStep } from "../steps/generate-image-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./get-or-create-course";

export type GeneratedContent = {
  description: string;
  imageUrl: string;
  alternativeTitles: string[];
  categories: string[];
  chapters: CourseChapter[];
};

async function descriptionOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string | null> {
  if (existing.description) {
    await streamSkipStep("generateDescription");
    return null;
  }
  return generateDescriptionStep(course);
}

async function imageOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string | null> {
  if (existing.imageUrl) {
    await streamSkipStep("generateImage");
    return null;
  }
  return generateImageStep(course);
}

async function altTitlesOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string[]> {
  if (existing.hasAlternativeTitles) {
    await streamSkipStep("generateAlternativeTitles");
    return [];
  }
  return generateAlternativeTitlesStep(course);
}

async function categoriesOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<string[]> {
  if (existing.hasCategories) {
    await streamSkipStep("generateCategories");
    return [];
  }

  if (course.targetLanguage) {
    await streamSkipStep("generateCategories");
    return ["languages"];
  }

  const categories = await generateCategoriesStep(course);

  return categories.filter((cat) => cat !== "languages");
}

async function chaptersOrSkip(
  course: CourseContext,
  existing: ExistingCourseContent,
): Promise<CourseChapter[]> {
  if (existing.hasChapters) {
    await streamSkipStep("generateChapters");
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
