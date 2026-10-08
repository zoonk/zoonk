import { getTestEnvironment } from "@zoonk/db/test-environment";

/**
 * Clears the AI budget newcomers share for real days once per run: test accounts are all younger
 * than a day, so a day of runs would otherwise spend it and refuse later tests' claims.
 */
export default async function setup() {
  Object.assign(process.env, getTestEnvironment("test"));

  const [{ prisma }, { resetNewcomerSpend }] = await Promise.all([
    import("@zoonk/db"),
    import("@zoonk/testing/fixtures/usage"),
  ]);

  await resetNewcomerSpend();
  await prisma.$disconnect();
}
