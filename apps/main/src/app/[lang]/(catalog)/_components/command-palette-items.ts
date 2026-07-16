import { type AppRoute } from "@/i18n/navigation";
import { type getMenu } from "@/lib/menu";
import { removeAccents } from "@zoonk/utils/string";
import { LogOutIcon, type LucideIcon } from "lucide-react";
import { type ChapterSearchResult, type CourseSearchResult } from "./search-courses-action";

type PaletteRoute = AppRoute<ReturnType<typeof getMenu>["url"]>;

export type NavigationPaletteItem = {
  icon: LucideIcon;
  id: string;
  kind: "navigation";
  label: string;
  searchValue: string;
  url: PaletteRoute;
};

export type LogoutPaletteItem = {
  icon: LucideIcon;
  id: string;
  kind: "logout";
  label: string;
  searchValue: string;
};

export type CoursePaletteItem = {
  course: CourseSearchResult;
  id: string;
  kind: "course";
  label: string;
  searchValue: string;
};

export type ChapterPaletteItem = {
  chapter: ChapterSearchResult;
  id: string;
  kind: "chapter";
  label: string;
  searchValue: string;
};

export type PaletteItem =
  | ChapterPaletteItem
  | CoursePaletteItem
  | LogoutPaletteItem
  | NavigationPaletteItem;

export type PaletteGroup = { id: string; items: PaletteItem[]; label: string };

/**
 * Navigation entries need both display text and a searchable value. Creating
 * them in one place keeps the label shown to learners in sync with the text
 * used by the palette filter.
 */
export function createNavigationPaletteItem({
  id,
  label,
  menu,
}: {
  id: string;
  label: string;
  menu: { icon: LucideIcon; url: PaletteRoute };
}): NavigationPaletteItem {
  return { icon: menu.icon, id, kind: "navigation", label, searchValue: label, url: menu.url };
}

/**
 * Logout behaves like the other account actions visually, but it must run the
 * auth side effect instead of navigating to an application route.
 */
export function createLogoutPaletteItem({ label }: { label: string }): LogoutPaletteItem {
  return { icon: LogOutIcon, id: "logout", kind: "logout", label, searchValue: label };
}

/**
 * Course search can match on title or description, so both fields need to stay
 * in the item's search value while the visible option keeps the compact title
 * and description layout.
 */
export function createCoursePaletteItem(course: CourseSearchResult): CoursePaletteItem {
  return {
    course,
    id: `course-${course.id}`,
    kind: "course",
    label: course.title,
    searchValue: [course.title, course.description, course.id].filter(Boolean).join(" "),
  };
}

/**
 * Chapter titles are often reused across courses, so the search value includes
 * the parent course context and description while the option still renders the
 * fields as separate lines.
 */
export function createChapterPaletteItem(chapter: ChapterSearchResult): ChapterPaletteItem {
  return {
    chapter,
    id: `chapter-${chapter.id}`,
    kind: "chapter",
    label: chapter.title,
    searchValue: [chapter.title, chapter.courseTitle, chapter.description, chapter.id]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Base UI's Autocomplete owns keyboard movement while this helper preserves the
 * previous matching behavior: normalize accents, ignore case, and hide groups
 * once none of their items match the query.
 */
export function getVisiblePaletteGroups({
  groups,
  query,
}: {
  groups: PaletteGroup[];
  query: string;
}) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesPaletteItem({ item, query })),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Autocomplete uses this string for item matching and form values; keeping it
 * separate from the visual label allows course and chapter descriptions to
 * remain searchable without flattening the rendered option.
 */
export function getPaletteItemSearchValue(item: PaletteItem) {
  return item.searchValue;
}

/**
 * Detailed items use a larger row layout because they contain media and
 * secondary text, while static actions should keep the compact item rhythm.
 */
export function isDetailedPaletteItem(item: PaletteItem) {
  return item.kind === "chapter" || item.kind === "course";
}

/**
 * Palette matching needs to be accent-insensitive because learners may search
 * localized titles without entering the exact diacritics stored in the catalog.
 */
function matchesPaletteItem({ item, query }: { item: PaletteItem; query: string }) {
  const normalizedQuery = normalizePaletteSearchText(query.trim());

  if (!normalizedQuery) {
    return true;
  }

  return normalizePaletteSearchText(item.searchValue).includes(normalizedQuery);
}

/**
 * Search text is normalized in one helper so every palette item kind follows
 * the same case and accent handling.
 */
function normalizePaletteSearchText(value: string) {
  return removeAccents(value).toLocaleLowerCase();
}
