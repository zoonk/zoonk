"use client";

import { getPathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

/**
 * Where a lesson opens in the player, in the page's language, for links that open it in a new tab
 * (a content gap's drill brings its lesson back without leaving the drill).
 */
export function useLessonPlayerHref(): (lessonId: string) => string {
  const locale = useLocale();
  return (lessonId) => getPathname({ href: `/learn/${lessonId}`, locale });
}
