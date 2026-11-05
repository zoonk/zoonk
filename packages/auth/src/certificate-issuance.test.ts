import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { issueEarnedCertificates } from "./certificate-issuance";
import { createCertificate, createLearner } from "./guests/_test-utils/learner-data";

function issue(userId: string, plus: "check" | { grantedAt: Date }, now = new Date()) {
  return prisma.$transaction((tx) => issueEarnedCertificates(tx, { now, plus, userId }));
}

function readIssuedAt(userId: string) {
  return prisma.certificate.findMany({ select: { issuedAt: true }, where: { userId } });
}

describe(issueEarnedCertificates, () => {
  it("issues a Plus learner's locked certificates once, keeping the first time", async () => {
    const userId = await createLearner({ isAnonymous: false });
    const first = new Date("2026-11-01T12:00:00Z");

    await Promise.all([
      createCertificate({ userId }),
      prisma.subscription.create({
        data: { plan: "plus", referenceId: userId, status: "active", userId },
      }),
    ]);

    await expect(issue(userId, "check", first)).resolves.toBe(1);
    await expect(issue(userId, "check")).resolves.toBe(0);
    await expect(readIssuedAt(userId)).resolves.toStrictEqual([{ issuedAt: first }]);
  });

  it("issues nothing to a learner without Plus unless a verified grant says they have it", async () => {
    const userId = await createLearner({ isAnonymous: false });
    await createCertificate({ userId });

    await expect(issue(userId, "check")).resolves.toBe(0);
    await expect(issue(userId, { grantedAt: new Date() })).resolves.toBe(1);
  });

  it("leaves out what was earned after a grant, so a grant delivered again late issues none of it", async () => {
    const userId = await createLearner({ isAnonymous: false });
    const earned = await createCertificate({ userId });
    const before = new Date(earned.createdAt.getTime() - 1000);

    await expect(issue(userId, { grantedAt: before })).resolves.toBe(0);
    await expect(issue(userId, { grantedAt: earned.createdAt })).resolves.toBe(1);
  });

  it("never issues a guest's certificates", async () => {
    const userId = await createLearner({ isAnonymous: true });
    await createCertificate({ userId });

    await expect(issue(userId, { grantedAt: new Date() })).resolves.toBe(0);
    await expect(readIssuedAt(userId)).resolves.toStrictEqual([{ issuedAt: null }]);
  });
});
