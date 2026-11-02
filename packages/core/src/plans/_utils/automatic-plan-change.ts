import { parsePlanChangePayload } from "./plan-change-payload";

export function asksAboutAutomaticChange({
  change,
  dateReached,
}: {
  change: { kind: string; payload: unknown };
  dateReached: boolean;
}): boolean {
  return (
    change.kind === "missedDays" &&
    !dateReached &&
    parsePlanChangePayload(change.payload).behind !== null
  );
}
