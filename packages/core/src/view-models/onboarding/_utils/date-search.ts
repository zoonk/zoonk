import "server-only";
import { claimAssist } from "../../../entitlements/claim-usage";

/**
 * Whether a web search for an exam's day may run now, as one of the learner's small AI calls:
 * reading a stored understanding or notice is free, but the search costs, so it counts, and past
 * the learner's cap it doesn't run (the card says the day is to be confirmed).
 */
export async function allowDateSearch(): Promise<boolean> {
  const usage = await claimAssist();
  return usage.status === "allowed";
}
