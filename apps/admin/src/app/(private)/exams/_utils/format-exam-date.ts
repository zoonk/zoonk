/**
 * Exam and registration dates are calendar days from the notice, stored as UTC
 * midnight. Formatting them in UTC keeps "Nov 15" from showing as "Nov 14" in
 * time zones behind UTC.
 */
export function formatExamDate(date: Date | null): string {
  return date ? date.toLocaleDateString("en", { timeZone: "UTC" }) : "—";
}
