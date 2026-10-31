import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { seed } from "@zoonk/e2e/fixtures/seed";
import { clearLeftOpenLiveCalls, resetGuestSpend } from "@zoonk/testing/fixtures/usage";

/**
 * Runs before the E2E build, which prerenders the catalog from the database, and again before the
 * tests, which also clears the AI budget guests share.
 */
export async function prepareE2EData(): Promise<void> {
  await seed();

  await Promise.all([getAiOrganization(), resetGuestSpend(), clearLeftOpenLiveCalls()]);
}
