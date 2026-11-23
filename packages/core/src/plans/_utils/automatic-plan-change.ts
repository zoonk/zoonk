import { parsePlanChangePayload } from "./plan-change-payload";

export function asksAboutAutomaticChange({
  change,
  dateReached,
}: {
  change: { kind: string; payload: unknown };
  dateReached: boolean;
}): boolean {
  const payload = parsePlanChangePayload(change.payload);

  return (
    Boolean(payload.livingPlanDay) ||
    (change.kind === "missedDays" && !dateReached && payload.behind !== null)
  );
}
