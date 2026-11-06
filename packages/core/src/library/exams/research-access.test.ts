import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { getFreshnessCommandAccess } from "./freshness-access";
import { getResearchAccess } from "./research-access";

function mockSessionWithRole({ role, userId }: { role: "admin" | "user"; userId: string }) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role } } as Awaited<ReturnType<typeof getSession>>,
  );
}

async function privateSourceFixture(ownerId: string) {
  const contentHash = `hash-${randomUUID()}`;

  const source = await sourceFixture({
    contentHash,
    identityKey: `private:${ownerId}:upload:${contentHash}`,
    kind: "upload",
    ownerId,
    url: null,
    visibility: "private",
  });

  await learnerSourceFixture({ sourceId: source.id, userId: ownerId });

  return source;
}

describe(getResearchAccess, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lets a learner research their own goal with their uploads", async () => {
    const user = await userFixture();

    const [goal, upload, other] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      privateSourceFixture(user.id),
      privateSourceFixture(user.id),
    ]);

    mockSession(user.id);

    await expect(
      getResearchAccess({ goalId: goal.id, sourceIds: [upload.id, other.id, upload.id] }),
    ).resolves.toStrictEqual({
      goalId: goal.id,
      researchRunId: null,
      sourceIds: [upload.id, other.id],
      status: "ready",
    });
  });

  it("refuses another learner's goal or upload, and Library sources nobody uploaded", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [ownGoal, otherGoal, otherUpload, shared] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: other.id }),
      privateSourceFixture(other.id),
      sourceFixture(),
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

    await expect(
      getResearchAccess({ goalId: ownGoal.id, sourceIds: [shared.id] }),
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

    await expect(getFreshnessCommandAccess(target)).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSessionWithRole({ role: "user", userId: learner.id });
    await expect(getFreshnessCommandAccess(target)).resolves.toStrictEqual({ status: "forbidden" });

    mockSessionWithRole({ role: "admin", userId: admin.id });

    await expect(getFreshnessCommandAccess(target)).resolves.toStrictEqual({
      status: "ready",
      target,
    });

    await expect(
      getFreshnessCommandAccess({ kind: "source", sourceId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await prisma.examBlueprint.delete({ where: { id: blueprint.id } });
    await expect(getFreshnessCommandAccess(target)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("names the target by its stored id, however each of several requests at once capitalizes it", async () => {
    const [admin, exam, source] = await Promise.all([
      userFixture({ role: "admin" }),
      examBlueprintFixture(),
      sourceFixture(),
    ]);

    mockSessionWithRole({ role: "admin", userId: admin.id });
    const examTarget = { examBlueprintId: exam.id, kind: "exam" as const };
    const sourceTarget = { kind: "source" as const, sourceId: source.id };

    await expect(
      Promise.all([
        getFreshnessCommandAccess(examTarget),
        getFreshnessCommandAccess({ ...examTarget, examBlueprintId: exam.id.toUpperCase() }),
        getFreshnessCommandAccess(sourceTarget),
        getFreshnessCommandAccess({ ...sourceTarget, sourceId: source.id.toUpperCase() }),
      ]),
    ).resolves.toStrictEqual([
      { status: "ready", target: examTarget },
      { status: "ready", target: examTarget },
      { status: "ready", target: sourceTarget },
      { status: "ready", target: sourceTarget },
    ]);
  });
});
