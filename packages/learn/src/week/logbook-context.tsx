"use client";

import { type WeeklyRecapResult } from "@zoonk/core/milestones/weekly-recap";
import { createContext, use } from "react";

export type WeeklyRecapView = Extract<WeeklyRecapResult, { status: "ready" }>["recap"];

/** Where the logbook leads: out of it, and into the next session. */
export type LogbookHrefs = { close: string; start: string };

type LogbookValue = {
  hrefs: LogbookHrefs;
  /** The learner's first name for "What a week, Ana!", when there is one. */
  learnerName: string | null;
  recap: WeeklyRecapView;
};

const LogbookContext = createContext<LogbookValue | null>(null);

export function LogbookProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: LogbookValue;
}) {
  return <LogbookContext value={value}>{children}</LogbookContext>;
}

export function useLogbook(): LogbookValue {
  const value = use(LogbookContext);

  if (!value) {
    throw new Error("Logbook parts must be used within a LogbookScreen");
  }

  return value;
}
