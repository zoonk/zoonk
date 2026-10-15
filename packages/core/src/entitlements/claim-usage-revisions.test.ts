import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  holdLearnerRevision,
  readLearnerRevision,
  waitForBlockedStatement,
} from "../_test-utils/learner-revision";
import { mockSession } from "../_test-utils/mock-session";
import { lockUsageForViewer } from "./_utils/usage-lock";
import { claimUsage } from "./claim-usage";

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

function makeMindMap(targetId = randomUUID()) {
  return claimUsage({ generated: true, kind: "mindMap", targetId });
}

describe("usage claim revisions", () => {
  it("raises the revision once for a new use the allowance counts", async () => {
    const user = await learner();

    await expect(makeMindMap()).resolves.toMatchObject({ status: "allowed" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);
  });

  it("leaves the revision alone for a retried target and a refused claim", async () => {
    const user = await learner();
    const targetId = randomUUID();

    await makeMindMap(targetId);
    await expect(makeMindMap(targetId)).resolves.toMatchObject({ status: "allowed" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);

    await usageRecordsFixture({ count: 3, kind: "mindMap", userId: user.id });
    await expect(makeMindMap()).resolves.toMatchObject({ status: "limitReached" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(4);
  });

  it("marks before the usage lock, so it waits behind a writer that marked first", async () => {
    const user = await learner();

    // The other writer follows the global order too: revision, then the usage lock.
    const writer = holdLearnerRevision({
      beforeCommit: (tx) => lockUsageForViewer({ transaction: tx, userId: user.id }),
      userId: user.id,
    });

    const pid = await writer.pid;
    const claim = makeMindMap();

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
    } finally {
      writer.release();
    }

    // A claim holding the usage lock while waiting for the revision would deadlock with it here.
    const outcomes = await Promise.allSettled([writer.done, claim]);
    expect(outcomes.map((outcome) => outcome.status)).toStrictEqual(["fulfilled", "fulfilled"]);
    await expect(claim).resolves.toMatchObject({ status: "allowed" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(2n);
  });
});
