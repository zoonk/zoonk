import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import { generateCategoriesStep } from "../steps/generate-categories-step";
import { generateChaptersStep } from "../steps/generate-chapters-step";
import { generateDescriptionStep } from "../steps/generate-description-step";
import { generateImageStep } from "../steps/generate-image-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";

export type GeneratedContent = {
  description: string;
  imageUrl: string;
  categories: string[];
  chapters: CourseChapter[];
};

type GenerateMissingContentInput = {
  course: CourseContext;
  description: string | null;
  existing: ExistingCourseContent;
};

type ExistingCourseStepInput = { course: CourseContext; existing: ExistingCourseContent };

type ImageStepInput = ExistingCourseStepInput & { description: string | null };

async function descriptionOrSkip({
  course,
  existing,
}: ExistingCourseStepInput): Promise<string | null> {
  if (existing.description) {
    await streamSkipStep("generateDescription");
    return null;
  }

  return generateDescriptionStep(course);
}

async function imageOrSkip({
  course,
  description,
  existing,
}: ImageStepInput): Promise<string | null> {
  if (existing.imageUrl) {
    await streamSkipStep("generateImage");
    return null;
  }

  return generateImageStep({ course, description });
}

async function categoriesOrSkip({ course, existing }: ExistingCourseStepInput): Promise<string[]> {
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

async function chaptersOrSkip({
  course,
  existing,
}: ExistingCourseStepInput): Promise<CourseChapter[]> {
  if (existing.hasChapters) {
    await streamSkipStep("generateChapters");
    return [];
  }

  return generateChaptersStep(course);
}

/**
 * Generates only the course pieces that are still missing so repeated setup
 * attempts preserve content that was already saved.
 */
export async function generateMissingContent({
  course,
  description,
  existing,
}: GenerateMissingContentInput): Promise<GeneratedContent> {
  const [generatedDescription, generatedImageUrl, categories, chapters] = await Promise.all([
    descriptionOrSkip({ course, existing }),
    imageOrSkip({ course, description, existing }),
    categoriesOrSkip({ course, existing }),
    chaptersOrSkip({ course, existing }),
  ]);

  return {
    categories,
    chapters,
    description: existing.description || generatedDescription || "",
    imageUrl: existing.imageUrl || generatedImageUrl || "",
  };
}
