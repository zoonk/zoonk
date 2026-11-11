import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { isPlusOnlyMockDay, loadWeekSkillIds } from "./load-weekly-challenge";

const NOW = new Date("2026-10-18T04:12:18Z");

describe("a full review in place of a Plus-only mock", () => {
  it.each([
    { date: "2026-10-17", includesMockExams: false, reviewDay: false },
    { date: "2026-10-18", includesMockExams: false, reviewDay: true },
    { date: "2026-10-19", includesMockExams: false, reviewDay: false },
    { date: "2026-10-18", includesMockExams: true, reviewDay: false },
  ])("uses the due date and access: %j", ({ date, includesMockExams, reviewDay }) => {
    expect(
      isPlusOnlyMockDay({
        includesMockExams,
        items: [{ kind: "mock", scheduledFor: new Date(date), status: "todo" }],
        today: new Date("2026-10-18"),
      }),
    ).toBe(reviewDay);
  });

  it("uses the next unfinished weekly challenge", () => {
    const today = new Date("2026-10-18");

    const mock = { kind: "mock" as const, scheduledFor: today, status: "todo" as const };

    const check = (items: Parameters<typeof isPlusOnlyMockDay>[0]["items"]) =>
      isPlusOnlyMockDay({ includesMockExams: false, items, today });

    expect(check([])).toBe(false);
    expect(check([{ ...mock, status: "done" }])).toBe(false);
    expect(check([{ ...mock, scheduledFor: null }])).toBe(false);
    expect(check([{ ...mock, kind: "checkpoint" }, mock])).toBe(false);
    expect(check([{ ...mock, kind: "checkpoint", status: "done" }, mock])).toBe(true);
  });
});

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
