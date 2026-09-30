import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { getFreshnessCommandAccess } from "./freshness-access";
import { getResearchAccess } from "./research-access";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

function mockSessionWithRole({ role, userId }: { role: "admin" | "user"; userId: string }) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role } } as Awaited<ReturnType<typeof getSession>>,
  );
}

function privateSourceFixture(ownerId: string) {
  const contentHash = `hash-${randomUUID()}`;

  return sourceFixture({
    contentHash,
    identityKey: `private:${ownerId}:upload:${contentHash}`,
    kind: "upload",
    ownerId,
    url: null,
    visibility: "private",
  });
}

describe(getResearchAccess, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lets a learner research their own goal with their uploads and shared sources", async () => {
    const user = await userFixture();

    const [goal, upload, shared] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      privateSourceFixture(user.id),
      sourceFixture(),
    ]);

    mockSession(user.id);

    await expect(
      getResearchAccess({ goalId: goal.id, sourceIds: [upload.id, shared.id, upload.id] }),
    ).resolves.toStrictEqual({
      goalId: goal.id,
      researchRunId: null,
      sourceIds: [upload.id, shared.id],
      status: "ready",
    });
  });

  it("refuses another learner's goal or private upload", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [ownGoal, otherGoal, otherUpload] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: other.id }),
      privateSourceFixture(other.id),
    ]);

    await expect(getResearchAccess({ goalId: ownGoal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(user.id);

    await expect(getResearchAccess({ goalId: otherGoal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      getResearchAccess({ goalId: ownGoal.id, sourceIds: [otherUpload.id] }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(getFreshnessCommandAccess, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lets only admins check an exam now or stop its checks", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    const blueprint = await examBlueprintFixture();
    const target = { examBlueprintId: blueprint.id, kind: "exam" as const };

    await expect(getFreshnessCommandAccess(target)).resolves.toBe("unauthorized");

    mockSessionWithRole({ role: "user", userId: learner.id });
    await expect(getFreshnessCommandAccess(target)).resolves.toBe("forbidden");

    mockSessionWithRole({ role: "admin", userId: admin.id });
    await expect(getFreshnessCommandAccess(target)).resolves.toBe("ready");

    await expect(
      getFreshnessCommandAccess({ kind: "source", sourceId: randomUUID() }),
    ).resolves.toBe("notFound");

    await prisma.examBlueprint.delete({ where: { id: blueprint.id } });
    await expect(getFreshnessCommandAccess(target)).resolves.toBe("notFound");
  });
});
