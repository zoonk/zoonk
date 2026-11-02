"use client";

import { getPathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";

export function useLessonPlayerHref(): (lessonId: string) => string {
  const locale = useAppLocale();
  return (lessonId) => getPathname({ href: `/learn/${lessonId}`, locale });
}
