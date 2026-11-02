import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";

const DEFAULT_CHAPTER_IMAGE = "/catalog/chapters/general.webp";

const DEFAULT_CHAPTER_IMAGES: Record<CourseCategory, string> = {
  arts: "/catalog/chapters/arts.webp",
  business: "/catalog/chapters/business.webp",
  communication: "/catalog/chapters/communication.webp",
  culture: "/catalog/chapters/culture.webp",
  economics: "/catalog/chapters/economics.webp",
  engineering: "/catalog/chapters/engineering.webp",
  exams: "/catalog/chapters/exams.webp",
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

function getValidCategory(category: string): CourseCategory | null {
  if (isValidCategory(category)) {
    return category;
  }

  return null;
}

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
