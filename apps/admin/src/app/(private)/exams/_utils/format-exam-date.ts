/** Dates are calendar days stored as UTC midnight, so UTC keeps "Nov 15" from showing as "Nov 14". */
export function formatExamDate(date: Date | null): string {
  return date ? date.toLocaleDateString("en", { timeZone: "UTC" }) : "—";
}
