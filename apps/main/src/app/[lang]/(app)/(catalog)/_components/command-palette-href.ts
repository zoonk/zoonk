import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { type PaletteItem } from "./command-palette-items";

export function getPaletteItemHref(item: PaletteItem) {
  if (item.kind === "navigation") {
    return item.url;
  }

  if (item.kind === "ask") {
    return item.question ? (`/buddy?ask=${encodeURIComponent(item.question)}` as const) : "/buddy";
  }

  if (item.kind === "startGoal") {
    return getGoalStartHref(item.prompt);
  }

  if (item.kind === "subject") {
    return `/plan/${item.subjectKey}` as const;
  }

  if (item.kind === "planChapter") {
    return item.unit
      ? (`/content/units/${item.chapterId}` as const)
      : (`/content/chapters/${item.chapterId}` as const);
  }

  if (item.kind === "explanation") {
    return `/explain/${item.goalId}` as const;
  }

  if (item.kind === "mockResult") {
    return `/mock/${item.blockId}` as const;
  }

  if (item.kind === "course") {
    return `/b/${item.course.brandSlug}/c/${item.course.slug}` as const;
  }

  if (item.kind === "chapter") {
    return `/b/${item.chapter.brandSlug}/c/${item.chapter.courseSlug}/ch/${item.chapter.slug}` as const;
  }

  return null;
}
