"use client";

import { getPathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";

type AppHref = Parameters<typeof getPathname>[0]["href"];

/**
 * Sign-up links are plain anchors (`/login` redirects to the auth app), so their href carries the
 * locale. Without `next`, the learner comes back to the page they left.
 */
export function useSignUpHref(next?: AppHref): string {
  const locale = useAppLocale();
  const login = getPathname({ href: "/login", locale });

  return next ? `${login}?next=${encodeURIComponent(getPathname({ href: next, locale }))}` : login;
}
