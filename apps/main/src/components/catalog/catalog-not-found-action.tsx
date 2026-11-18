"use client";

import { MainDocumentLink } from "@/components/main-document-link";
import { getPathname } from "@/i18n/navigation";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useAppLocale } from "@zoonk/learn/locale";

export function CatalogNotFoundAction({ courses, today }: { courses: string; today: string }) {
  const learner = useLearnerSummary();
  const locale = useAppLocale();

  return learner.status === "ready" ? (
    <MainDocumentLink href={getPathname({ href: "/today", locale })}>{today}</MainDocumentLink>
  ) : (
    <MainDocumentLink href={getPathname({ href: "/courses", locale })}>{courses}</MainDocumentLink>
  );
}
