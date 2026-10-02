"use client";

import { type FieldMapView } from "@zoonk/core/view-models/map/contract";
import { createContext, use } from "react";
import { type AreaPracticeOutcome } from "../progress/progress-context";

type CourseLink = { brandSlug: string; courseSlug: string };

/**
 * Where the map links: back to where it opened from, each chapter's page (the chapter id is
 * appended) and a course's public page.
 */
export type FieldMapHrefs = {
  back: string;
  chapterBasePath: string;
  course: (course: CourseLink) => string;
};

/**
 * "Refresh now" adds practice on the fading skills; "Continue at Beginner" starts the next level.
 * The host opens what they start and resolves to how it went.
 */
export type FieldMapActions = {
  continueNextLevel: () => Promise<boolean>;
  refresh: () => Promise<AreaPracticeOutcome>;
};

type FieldMapValue = { actions: FieldMapActions; hrefs: FieldMapHrefs; map: FieldMapView };

const FieldMapContext = createContext<FieldMapValue | null>(null);

export function FieldMapProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: FieldMapValue;
}) {
  return <FieldMapContext value={value}>{children}</FieldMapContext>;
}

export function useFieldMap(): FieldMapValue {
  const value = use(FieldMapContext);

  if (!value) {
    throw new Error("Map components must be used within FieldMapScreen");
  }

  return value;
}
