import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getUsageRule } from "../entitlements/limits";
import { freezeClock } from "./frozen-clock";
import { mockGuestSession } from "./mock-session";

const GUEST_DAILY_HELP = getUsageRule({ kind: "assist", tier: "guest" }).day ?? 0;

export const GUEST_OUT_OF_HELP = {
  limit: { limit: GUEST_DAILY_HELP, period: "day", resource: "assist", tier: "guest" },
  status: "limitReached",
} as const;

export async function useGuestOutOfHelp() {
  freezeClock();
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
