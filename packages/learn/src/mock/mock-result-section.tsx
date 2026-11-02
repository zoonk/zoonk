"use client";

import { useId } from "react";
import { PageSection, PageSectionTitle } from "../_components/page";

export function ResultSection({ children, title }: { children: React.ReactNode; title: string }) {
  const id = useId();

  return (
    <PageSection aria-labelledby={id} className="w-full">
      <PageSectionTitle id={id}>{title}</PageSectionTitle>
      {children}
    </PageSection>
  );
}
