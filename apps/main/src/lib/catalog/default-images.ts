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
 * Fallback art follows the course's first valid category, so a course without
 * its own image still gets a share card that fits its subject.
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
