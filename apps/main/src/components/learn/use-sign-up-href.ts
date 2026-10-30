"use client";

import { getPathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

/** Sign-up links are plain anchors (`/login` redirects to the auth app), so their href carries the locale. */
export function useSignUpHref(): string {
  return getPathname({ href: "/login", locale: useLocale() });
}
