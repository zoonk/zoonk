"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { PageSection, PageSectionTitle } from "../_components/page";

/** `rows` is a list of rows under the title: their own padding is the gap, so the title stays theirs. */
export function ResultSection({
  children,
  rows = false,
  title,
}: {
  children: React.ReactNode;
  rows?: boolean;
  title: string;
}) {
  const id = useId();

  return (
    <PageSection aria-labelledby={id} className={cn("w-full", rows && "gap-0")}>
      <PageSectionTitle id={id}>{title}</PageSectionTitle>
      {children}
    </PageSection>
  );
}
