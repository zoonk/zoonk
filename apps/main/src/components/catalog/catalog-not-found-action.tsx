"use client";

import { MainDocumentLink } from "@/components/main-document-link";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";

export function CatalogNotFoundAction({ courses, today }: { courses: string; today: string }) {
  const learner = useLearnerSummary();

  return learner.status === "ready" ? (
    <MainDocumentLink href="/today">{today}</MainDocumentLink>
  ) : (
    <MainDocumentLink href="/courses">{courses}</MainDocumentLink>
  );
}
