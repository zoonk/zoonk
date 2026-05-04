import { type LessonKind } from "@zoonk/db";
import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";

const DEFAULT_CHAPTER_IMAGE = "/catalog/chapters/general.webp";

const DEFAULT_CHAPTER_IMAGES: Record<CourseCategory, string> = {
  arts: "/catalog/chapters/arts.webp",
  business: "/catalog/chapters/business.webp",
  communication: "/catalog/chapters/communication.webp",
  culture: "/catalog/chapters/culture.webp",
  economics: "/catalog/chapters/economics.webp",
  engineering: "/catalog/chapters/engineering.webp",
  geography: "/catalog/chapters/geography.webp",
  health: "/catalog/chapters/health.webp",
  history: "/catalog/chapters/history.webp",
  languages: "/catalog/chapters/languages.webp",
  law: "/catalog/chapters/law.webp",
  math: "/catalog/chapters/math.webp",
  science: "/catalog/chapters/science.webp",
  society: "/catalog/chapters/society.webp",
  tech: "/catalog/chapters/tech.webp",
};

const DEFAULT_LESSON_IMAGES: Record<LessonKind, string> = {
  alphabet: "/catalog/lessons/alphabet.webp",
  custom: "/catalog/lessons/custom.webp",
  explanation: "/catalog/lessons/explanation.webp",
  grammar: "/catalog/lessons/grammar.webp",
  listening: "/catalog/lessons/listening.webp",
  practice: "/catalog/lessons/practice.webp",
  quiz: "/catalog/lessons/quiz.webp",
  reading: "/catalog/lessons/reading.webp",
  review: "/catalog/lessons/review.webp",
  translation: "/catalog/lessons/translation.webp",
  tutorial: "/catalog/lessons/tutorial.webp",
  vocabulary: "/catalog/lessons/vocabulary.webp",
};

/**
 * Category rows come from the database as strings, so this keeps the validation
 * boundary next to the map that requires known course categories.
 */
function getValidCategory(category: string): CourseCategory | null {
  if (isValidCategory(category)) {
    return category;
  }

  return null;
}

/**
 * Chapter fallback art should follow the course's first valid category so a
 * course page has a coherent visual theme even when individual chapters do not
 * have generated thumbnails yet.
 */
export function getDefaultChapterImage({
  categories,
}: {
  categories: { category: string }[];
}): string {
  const category = categories.map((item) => getValidCategory(item.category)).find(Boolean);

  if (!category) {
    return DEFAULT_CHAPTER_IMAGE;
  }

  return DEFAULT_CHAPTER_IMAGES[category];
}

/**
 * Lesson fallback art is keyed by the generated lesson kind because companion
 * lessons often do not have saved thumbnails when the chapter page first lists
 * them.
 */
export function getDefaultLessonImage(kind: LessonKind): string {
  return DEFAULT_LESSON_IMAGES[kind];
}
