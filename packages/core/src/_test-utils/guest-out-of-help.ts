import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getUsageRule } from "../entitlements/limits";
import { mockGuestSession } from "./mock-session";

const GUEST_DAILY_HELP = getUsageRule({ kind: "assist", tier: "guest" }).day ?? 0;

/** What a small AI call answers a guest who used today's help: sign up to keep going. */
export const GUEST_OUT_OF_HELP = {
  limit: { limit: GUEST_DAILY_HELP, period: "day", resource: "assist", tier: "guest" },
  status: "limitReached",
} as const;

/** Signs in as a guest who already used today's small AI help, so the next AI call is refused. */
export async function useGuestOutOfHelp() {
  const guest = await userFixture();

  await usageRecordsFixture({
    count: GUEST_DAILY_HELP,
    createdAt: new Date(),
    kind: "assist",
    userId: guest.id,
  });

  mockGuestSession(guest.id);
  return guest;
}
