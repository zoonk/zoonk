import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";

export const libraryLessonStatuses = [
  "all",
  "completed",
  "pending",
  "running",
  "failed",
  "setAside",
] as const;
export type LibraryLessonStatus = (typeof libraryLessonStatuses)[number];

export const libraryLessonStatusLabels: Record<LibraryLessonStatus, string> = {
  all: "All",
  completed: "Written",
  failed: "Failed",
  pending: "Not written",
  running: "Writing",
  setAside: "Set aside",
};

type SearchParamValue = string | string[] | undefined;

export function parseLibraryLessonStatus(value: SearchParamValue): LibraryLessonStatus {
  return readEnumQueryParam({ allowed: libraryLessonStatuses, value }) ?? "all";
}

export function parseProvenanceFilter(value: SearchParamValue): string | undefined {
  return readQueryParam(value)?.trim() || undefined;
}
