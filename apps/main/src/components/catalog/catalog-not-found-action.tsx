"use client";

import { MainDocumentLink } from "@/components/main-document-link";
import { getPathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";

/** The sign-in hint picks the action before the first paint; Enter presses only the one drawn. */
export function CatalogNotFoundAction({ courses, today }: { courses: string; today: string }) {
  const locale = useAppLocale();

  return (
    <>
      <span className="signed-in:hidden contents">
        <MainDocumentLink href={getPathname({ href: "/courses", locale })}>
          {courses}
        </MainDocumentLink>
      </span>

      <span className="contents [:root:not([data-signed-in])_&]:hidden">
        <MainDocumentLink href={getPathname({ href: "/today", locale })}>{today}</MainDocumentLink>
      </span>
    </>
  );
}
