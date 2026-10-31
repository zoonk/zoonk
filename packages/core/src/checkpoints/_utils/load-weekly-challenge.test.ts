import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadWeekSkillIds } from "./load-weekly-challenge";

const NOW = new Date("2026-10-18T04:12:18Z");

describe("a weekly challenge's skills", () => {
  it("keeps plan order when answers share a timestamp", async () => {
    const user = await userFixture();
    const first = await skillFixture();
    const second = await skillFixture();
    const outsideWeek = await skillFixture();

    await attemptFixture({ answeredAt: NOW, skillId: first.id, userId: user.id });
    await attemptFixture({ answeredAt: NOW, skillId: second.id, userId: user.id });
    await attemptFixture({ answeredAt: NOW, skillId: first.id, userId: user.id });

    await attemptFixture({
      answeredAt: new Date("2026-10-10T04:12:18Z"),
      skillId: outsideWeek.id,
      userId: user.id,
    });

    await expect(
      loadWeekSkillIds({
        now: NOW,
        skillIds: [second.id, outsideWeek.id, first.id],
        userId: user.id,
      }),
    ).resolves.toStrictEqual([second.id, first.id]);
  });
});
