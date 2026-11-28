import { USAGE_KINDS, prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadRollingUsage } from "./rolling-usage";

describe(loadRollingUsage, () => {
  it("counts every usage kind under its own name", async () => {
    const user = await userFixture();
    const kinds = Object.values(USAGE_KINDS);

    await Promise.all(
      kinds.map((kind) => usageRecordsFixture({ count: 1, kind, seconds: 1, userId: user.id })),
    );

    const usage = await loadRollingUsage({ client: prisma, now: new Date(), userId: user.id });

    expect(Object.fromEntries(kinds.map((kind) => [kind, usage.get(kind)?.count]))).toStrictEqual(
      Object.fromEntries(kinds.map((kind) => [kind, 1])),
    );
  });
});
