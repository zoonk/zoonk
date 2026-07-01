import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type CourseChapter } from "@zoonk/ai/tasks/courses/chapters";
import { type CourseLandingPageSchema } from "@zoonk/ai/tasks/courses/landing-page";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { generateCategoriesStep } from "../steps/generate-categories-step";
import { generateChaptersStep } from "../steps/generate-chapters-step";
import { generateDescriptionStep } from "../steps/generate-description-step";
import { generateImageStep } from "../steps/generate-image-step";
import { generateLandingPageStep } from "../steps/generate-landing-page-step";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";

export type GeneratedContent = {
  description: string;
  imageUrl: string;
  landingPage: CourseLandingPageContent | null;
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

type LandingPageStepInput = ExistingCourseStepInput & {
  chapters: CourseChapter[];
  description: string;
};

/**
 * Avoids regenerating the short course summary during retry/resume flows. The
 * saved description is considered the source of truth once it exists.
 */
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

/**
 * Runs landing-page generation only after dependent course context has been
 * resolved. This keeps the task from writing generic copy when a brand-new
 * course did not have a description or chapter outline yet.
 */
async function landingPageOrSkip({
  chapters,
  course,
  description,
  existing,
}: LandingPageStepInput): Promise<CourseLandingPageSchema | null> {
  if (course.targetLanguage) {
    await streamSkipStep("generateLandingPage");
    return null;
  }

  if (existing.landingPage) {
    await streamSkipStep("generateLandingPage");
    return null;
  }

  return generateLandingPageStep({ chapters, course, description });
}

/**
 * Non-language courses need generated landing copy because their no-progress
 * page depends on topic-specific outcomes, audience, and opportunity sections.
 * Language courses use a static structure instead, so missing generated copy is
 * valid for them.
 */
function getLandingPage({
  course,
  existing,
  generated,
}: {
  course: CourseContext;
  existing: ExistingCourseContent;
  generated: CourseLandingPageSchema | null;
}): CourseLandingPageContent | null {
  if (existing.landingPage) {
    return existing.landingPage;
  }

  if (course.targetLanguage) {
    return null;
  }

  if (generated) {
    return getGeneratedLandingPageContent(generated);
  }

  throw new Error("Course landing page generation did not return copy");
}

/**
 * Converts the current AI output into the stored course page content contract.
 * The fields match today, but keeping this copy explicit prevents callers from
 * treating the AI task schema as the database/UI schema when either side grows.
 */
function getGeneratedLandingPageContent(
  generated: CourseLandingPageSchema,
): CourseLandingPageContent {
  return {
    audience: generated.audience,
    opportunities: generated.opportunities,
    outcomes: generated.outcomes,
    valueProposition: generated.valueProposition,
  };
}

/**
 * Chooses the description that both persistence and landing copy should agree
 * on. A generated course description is preferred for new courses because it is
 * the canonical course summary; the request text is only a fallback for unusual
 * recovery paths where generation was skipped but no saved description exists.
 */
function getResolvedDescription({
  existing,
  generated,
  requestDescription,
}: {
  existing: ExistingCourseContent;
  generated: string | null;
  requestDescription: string | null;
}): string {
  return existing.description || generated || requestDescription || "";
}

/**
 * Reuses a saved thumbnail when setup is recovering an existing course. New
 * image generation can still use the original request text because that often
 * contains visual intent that the generated summary may omit.
 */
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

/**
 * Keeps course categorization idempotent and prevents language courses from
 * spending a model call on a category that is already known from the route.
 */
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

/**
 * Generates a new chapter outline only when the course does not already have
 * chapters. Existing chapter rows are handled separately so retrying setup does
 * not duplicate curriculum content.
 */
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

  const resolvedDescription = getResolvedDescription({
    existing,
    generated: generatedDescription,
    requestDescription: description,
  });

  const generatedLandingPage = await landingPageOrSkip({
    chapters,
    course,
    description: resolvedDescription,
    existing,
  });

  return {
    categories,
    chapters,
    description: resolvedDescription,
    imageUrl: existing.imageUrl || generatedImageUrl || "",
    landingPage: getLandingPage({ course, existing, generated: generatedLandingPage }),
  };
}
