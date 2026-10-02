"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { createContext, use } from "react";

/** Where Progress links: the mistakes notebook and the stats pages behind each number. */
export type ProgressHrefs = {
  activity: string;
  energy: string;
  /** An exam goal's screen (exam map, scoring, mocks); hosts without it leave it out. */
  exam?: string;
  level: string;
  mistakes: string;
  patterns: string;
  score: string;
};

/** How "Practice now" went; on "started" the host has already opened the practice. */
export type AreaPracticeOutcome = "dailyCap" | "failed" | "nothingToPractice" | "started";

/** The host adds the practice through core and opens it. */
export type ProgressActions = { practiceArea: (areaId: string) => Promise<AreaPracticeOutcome> };

type ProgressScreenValue = {
  actions: ProgressActions;
  hrefs: ProgressHrefs;
  progress: ProgressView;
};

const ProgressScreenContext = createContext<ProgressScreenValue | null>(null);

export function ProgressScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ProgressScreenValue;
}) {
  return <ProgressScreenContext value={value}>{children}</ProgressScreenContext>;
}

type Preparation = NonNullable<ProgressView["preparation"]>;

/**
 * The goal's preparation, for the parts of Progress that draw it. Explanations have none, so the
 * screen shows those parts only for goals with one.
 */
export function usePreparation(): Preparation {
  const { progress } = useProgressScreen();

  if (!progress.preparation) {
    throw new Error("Preparation components need a goal with preparation");
  }

  return progress.preparation;
}

export function useProgressScreen(): ProgressScreenValue {
  const value = use(ProgressScreenContext);

  if (!value) {
    throw new Error("Progress components must be used within ProgressScreen");
  }

  return value;
}
