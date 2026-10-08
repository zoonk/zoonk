import { randomUUID } from "node:crypto";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSource } from "./get-source";
import { listLearnerSources } from "./list-learner-sources";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

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

describe(getSource, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns a public source to anyone, without its text", async () => {
    const source = await sourceFixture({ extractedText: "Edital completo" });

    const result = await getSource({ sourceId: source.id });

    expect(result?.id).toBe(source.id);
    expect(result).not.toHaveProperty("extractedText");
  });

  it("returns a private upload only to its owner", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const source = await privateSourceFixture(owner.id);

    await expect(getSource({ sourceId: source.id })).resolves.toBeNull();

    mockSession(other.id);
    await expect(getSource({ sourceId: source.id })).resolves.toBeNull();

    mockSession(owner.id);
    await expect(getSource({ sourceId: source.id })).resolves.toMatchObject({ id: source.id });
  });

  it("returns null for ids that aren't sources", async () => {
    await expect(getSource({ sourceId: "not-a-uuid" })).resolves.toBeNull();
    await expect(getSource({ sourceId: randomUUID() })).resolves.toBeNull();
  });
});

describe(listLearnerSources, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lists only the learner's own material, newest first, optionally for one goal", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ userId: user.id });

    const [older, newer, othersSource] = await Promise.all([
      sourceFixture(),
      privateSourceFixture(user.id),
      privateSourceFixture(other.id),
    ]);

    await learnerSourceFixture({
      createdAt: new Date(Date.now() - 60_000),
      sourceId: older.id,
      userId: user.id,
    });

    await learnerSourceFixture({ goalId: goal.id, sourceId: newer.id, userId: user.id });
    await learnerSourceFixture({ sourceId: othersSource.id, userId: other.id });

    await expect(listLearnerSources()).resolves.toBeNull();

    mockSession(user.id);

    const all = await listLearnerSources();
    expect(all?.map((link) => link.source.id)).toStrictEqual([newer.id, older.id]);

    const forGoal = await listLearnerSources({ goalId: goal.id });
    expect(forGoal?.map((link) => link.source.id)).toStrictEqual([newer.id]);
  });
});
