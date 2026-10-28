import "server-only";
import { claimAssist } from "../../../entitlements/claim-usage";

/** Claims a small AI allowance before date search; stored facts do not need this claim. */
export async function allowDateSearch(): Promise<boolean> {
  const usage = await claimAssist();
  return usage.status === "allowed";
}
