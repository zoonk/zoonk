import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { API_URL } from "@zoonk/utils/url";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { listOwed } from "../_test-utils/follow-ups";
import { FOLLOW_UP_SECRET_HEADER, type FollowUp } from "./follow-up-contract";
import {
  countFollowUps,
  endFollowUp,
  listFollowUps,
  listLearnersWithOldFollowUps,
} from "./follow-up-rows";
import { oweFollowUps } from "./owe-follow-ups";

const LESSON_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";

function writeLesson(lessonId = LESSON_ID): FollowUp {
  return { input: { lessonId }, kind: "writeLesson" };
}

function prepareGoal(lessonsAskedAt: number | null): FollowUp {
  return { input: { goalId: LESSON_ID, lessonsAskedAt }, kind: "prepareGoalLessons" };
}

describe(oweFollowUps, () => {
  it("asks again for work still owed instead of owing it twice", async () => {
    const user = await userFixture();

    await oweFollowUps({ followUps: [prepareGoal(1)], userId: user.id });
    const [first] = await listFollowUps(user.id);

    await oweFollowUps({ followUps: [prepareGoal(2)], userId: user.id });
    const owed = await listFollowUps(user.id);

    expect(owed).toMatchObject([{ id: first?.id, input: { lessonsAskedAt: 2 }, revision: 1 }]);
  });

  it("owes nothing when the write's transaction rolls back", async () => {
    const user = await userFixture();

    await expect(
      prisma.$transaction(async (tx) => {
        await oweFollowUps({ db: tx, followUps: [writeLesson()], userId: user.id });
        throw new Error("The write failed");
      }),
    ).rejects.toThrow("The write failed");

    await expect(listOwed(user.id)).resolves.toStrictEqual([]);
  });

  it("asks the API to run the learner's work, with the shared secret", async () => {
    const user = await userFixture();
    const flush = runDeferredWork();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 202 }));

    vi.stubEnv("APP_FOLLOW_UP_SECRET", "test-secret");
    vi.stubGlobal("fetch", fetch);

    await oweFollowUps({ followUps: [writeLesson()], userId: user.id });
    await flush();

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `${API_URL}/internal/follow-ups`,
      expect.objectContaining({
        body: JSON.stringify({ userId: user.id }),
        headers: expect.objectContaining({ [FOLLOW_UP_SECRET_HEADER]: "test-secret" }),
        method: "POST",
      }),
    );
  });

  it("keeps the rows for the daily sweep when the API can't be asked", async () => {
    const user = await userFixture();
    const flush = runDeferredWork();

    vi.stubEnv("APP_FOLLOW_UP_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API down")));

    await oweFollowUps({ followUps: [writeLesson()], userId: user.id });
    await flush();

    await expect(countFollowUps(user.id)).resolves.toBe(1);
  });
});

describe(endFollowUp, () => {
  it("keeps a row asked for again after it was listed, even in the same millisecond, and ends its newer ask", async () => {
    const user = await userFixture();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));

    await oweFollowUps({ followUps: [writeLesson()], userId: user.id });
    const [listed] = await listFollowUps(user.id);

    await oweFollowUps({ followUps: [writeLesson()], userId: user.id });
    await endFollowUp({ id: listed?.id ?? "", revision: listed?.revision ?? 0 });

    const [again] = await listFollowUps(user.id);
    vi.useRealTimers();

    expect(again).toMatchObject({ id: listed?.id, revision: 1 });

    await endFollowUp({ id: again?.id ?? "", revision: again?.revision ?? 0 });
    await expect(countFollowUps(user.id)).resolves.toBe(0);
  });
});

describe(listFollowUps, () => {
  it("reads only the learner's work, oldest first, and drops a row whose input no longer reads", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const second = "019c9bd7-bf11-73cb-9cc8-fe371298190c";

    await oweFollowUps({ followUps: [writeLesson()], userId: user.id });
    await oweFollowUps({ followUps: [writeLesson(second)], userId: user.id });
    await oweFollowUps({ followUps: [writeLesson()], userId: other.id });

    await prisma.followUp.create({
      data: { input: { lesson: "?" }, key: "broken", kind: "writeLesson", userId: user.id },
    });

    const owed = await listFollowUps(user.id);

    expect(owed.map((row) => row.key)).toStrictEqual([LESSON_ID, second]);
    await expect(countFollowUps(user.id)).resolves.toBe(2);
  });
});

describe(listLearnersWithOldFollowUps, () => {
  it("lists learners whose work no run took within 15 minutes", async () => {
    const [waiting, recent] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      oweFollowUps({ followUps: [writeLesson()], userId: waiting.id }),
      oweFollowUps({ followUps: [writeLesson()], userId: recent.id }),
    ]);

    await prisma.followUp.updateMany({
      data: { requestedAt: new Date(Date.now() - 20 * 60_000) },
      where: { userId: waiting.id },
    });

    const learners = await listLearnersWithOldFollowUps();

    expect(learners).toContain(waiting.id);
    expect(learners).not.toContain(recent.id);
  });
});
