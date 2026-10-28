"use client";

import { getPathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export function useLessonPlayerHref(): (lessonId: string) => string {
  const locale = useLocale();
  return (lessonId) => getPathname({ href: `/learn/${lessonId}`, locale });
}
