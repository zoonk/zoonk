import { formatDay } from "@/lib/format";

export function formatExamDate(date: Date | null): string {
  return date ? formatDay(date, { year: true }) : "—";
}
