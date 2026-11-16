import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listCurrentUserCertificateProgress } from "./list-certificate-progress";

describe("certificate progress read", () => {
  it("requires a session", async () => {
    mockSession(null);

    await expect(listCurrentUserCertificateProgress()).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it.each([0, 1])("credits %i studied lessons, never known lessons", async (studied) => {
    const user = await userFixture();
    const [goal, skill] = await Promise.all([goalFixture({ userId: user.id }), skillFixture()]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        skills: [{ area: "Science", lessons: 4, name: skill.name, phase: 0, skillId: skill.id }],
      },
    });

    await Promise.all([
      planItemFixture({
        lessons: 1,
        planId: plan.id,
        position: 0,
        skillId: skill.id,
        status: studied ? "done" : "testedOut",
      }),
      planItemFixture({
        lessons: 3,
        planId: plan.id,
        position: 1,
        skillId: skill.id,
        status: "testedOut",
      }),
    ]);

    const other = await userFixture();
    mockSession(other.id);

    await expect(listCurrentUserCertificateProgress()).resolves.toStrictEqual({
      status: "ready",
      upNext: [],
    });

    mockSession(user.id);
    const result = await listCurrentUserCertificateProgress();

    expect(result).toMatchObject({
      status: "ready",
      upNext: [{ id: goal.id, progress: studied / 4 }],
    });
  });
});
