"use client";

import { useId } from "react";
import { PageSection, PageSectionTitle } from "../_components/page";

/**
 * A block of the result's page under its label (each area, what the mock showed, the questions to
 * review), after the score: flat on the page, named by its label for screen readers.
 */
export function ResultSection({ children, title }: { children: React.ReactNode; title: string }) {
  const id = useId();

  return (
    <PageSection aria-labelledby={id} className="w-full">
      <PageSectionTitle id={id}>{title}</PageSectionTitle>
      {children}
    </PageSection>
  );
}
