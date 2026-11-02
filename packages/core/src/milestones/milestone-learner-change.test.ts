import { prisma } from "@zoonk/db";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { awardMilestones } from "./award-milestones";
import { markMilestoneShown } from "./list-milestones";

async function setup() {
  const user = await userFixture();
  const { plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  mockSession(user.id);
  return { plan, user };
}

async function versions({ plan }: Awaited<ReturnType<typeof setup>>) {
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { inputVersion: saved.inputVersion };
}

describe("milestone writes", () => {
  it("concurrent awards commit once and a replay writes nothing", async () => {
    const day = await setup();
    const before = await versions(day);

    const award = () =>
      awardMilestones({ brainPower: { after: 7600, before: 7400 }, userId: day.user.id });

    await Promise.all([award(), award()]);
    const rows = await prisma.milestone.findMany({ where: { userId: day.user.id } });

    expect(rows.map(({ key, kind }) => `${kind}:${key}`).toSorted()).toStrictEqual([
      "belt:orange",
      "buddyStage:young",
    ]);

    const changed = { ...before };
    await expect(versions(day)).resolves.toStrictEqual(changed);
    await expect(award()).resolves.toStrictEqual([]);
    await expect(versions(day)).resolves.toStrictEqual(changed);
  });

  it("concurrent ceremony acknowledgements keep one timestamp without invalidating", async () => {
    const day = await setup();
    const row = await milestoneFixture({ key: "young", kind: "buddyStage", userId: day.user.id });
    const before = await versions(day);

    await expect(
      Promise.all([markMilestoneShown(row.id), markMilestoneShown(row.id)]),
    ).resolves.toMatchObject([{ status: "ready" }, { status: "ready" }]);

    const shown = await prisma.milestone.findUniqueOrThrow({ where: { id: row.id } });
    expect(shown.shownAt).toBeInstanceOf(Date);
    const changed = { ...before };
    await expect(versions(day)).resolves.toStrictEqual(changed);
    expect(revalidateTag).not.toHaveBeenCalled();

    await expect(markMilestoneShown(row.id)).resolves.toMatchObject({
      milestone: { shownAt: shown.shownAt },
      status: "ready",
    });

    await expect(versions(day)).resolves.toStrictEqual(changed);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refusing another learner's ceremony rolls back the early mark", async () => {
    const [day, other] = await Promise.all([setup(), userFixture()]);
    const row = await milestoneFixture({ userId: other.id });
    const before = await versions(day);
    await expect(markMilestoneShown(row.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(versions(day)).resolves.toStrictEqual(before);

    await expect(
      prisma.milestone.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ shownAt: null, userId: other.id });
  });
});
