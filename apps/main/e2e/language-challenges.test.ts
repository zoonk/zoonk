import { type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { expect, test } from "./fixtures";
import { createLanguageChallenge } from "./language-challenge-fixtures";
import { answerLiveCalls } from "./live-peer";
import { openAs } from "./study-day";

const EXHAUSTED_CALL_SECONDS = 120;

/** A locked challenge creates no call or AI request, and adds no call seconds or AI spend. */
async function expectNoChallengeSpend(userId: string) {
  const [conversations, calls, usage] = await Promise.all([
    prisma.languageConversation.count({ where: { userId } }),
    prisma.aiCall.count({ where: { userId } }),
    prisma.usageRecord.findMany({ where: { userId } }),
  ]);

  expect(conversations).toBe(0);
  expect(calls).toBe(0);
  expect(usage.reduce((total, record) => total + record.seconds, 0)).toBe(EXHAUSTED_CALL_SECONDS);
  expect(usage.every((record) => record.costMicros === 0 && !record.generated)).toBe(true);
  expect(usage.every((record) => ["conversation", "lessonStart"].includes(record.kind))).toBe(true);
}

test("a Free learner can open the next lesson while the earlier call challenge stays locked", async ({
  browser,
}) => {
  const { block, nextBlock, nextLesson, user } = await createLanguageChallenge({
    final: false,
    nextLessonTodo: true,
  });

  await usageRecordsFixture({
    count: 1,
    kind: "conversation",
    seconds: EXHAUSTED_CALL_SECONDS,
    userId: user.id,
  });

  const page = await openAs(browser, user);
  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  const lessonName = `${nextLesson?.title}, counts toward a mission`;
  await expect(today.getByRole("button", { exact: true, name: lessonName })).toBeVisible();
  await today.getByRole("button", { name: /^Start session/u }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${nextLesson?.id}\\?session=`, "u"));
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: nextBlock?.id } }),
  ).resolves.toMatchObject({ status: "active" });

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ startedAt: null, status: "pending" });

  await expectNoChallengeSpend(user.id);
  await page.context().close();
});

test("a Plus learner's written challenge creates its call only on Start", async ({ browser }) => {
  const { block, boss, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await answerLiveCalls(page, "answers");

  await page.goto(`/challenge/${boss.id}`);
  await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  await expect(prisma.aiCall.count({ where: { userId: user.id } })).resolves.toBe(0);
  await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  await page.getByRole("button", { name: "Start the call" }).click();

  await expect(
    page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
  ).toBeVisible();

  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(1);

  await page.getByRole("button", { exact: true, name: "End" }).click();
  await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "completed" });

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  await page.goto(`/checkpoint/${block.id}`);
  await expect(page).toHaveURL(/\/conversation\//u);
  await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

  await page.context().close();
});

test("leaving cancels a checkpoint Start resolved after returning", async ({ browser }) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await answerLiveCalls(page, "answers");
  await watchMicrophone(page);
  await page.goto(`/checkpoint/${block.id}`);
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

  const held = Promise.withResolvers<Request>();
  const release = Promise.withResolvers<null>();
  const delivered = Promise.withResolvers<null>();
  const secondStart = Promise.withResolvers<null>();
  const requests = { starts: 0 };

  await page.route(`**/checkpoint/${block.id}`, async (route) => {
    if (route.request().method() !== "POST" || !route.request().postData()?.includes(block.id)) {
      await route.continue();
      return;
    }

    requests.starts += 1;

    if (requests.starts !== 1) {
      secondStart.resolve(null);
      await route.continue();
      return;
    }

    const response = await route.fetch();
    held.resolve(route.request());
    await release.promise;

    try {
      await route.fulfill({ response });
    } finally {
      delivered.resolve(null);
    }
  });

  try {
    await page.getByRole("button", { name: "Start the call" }).click();
    await held.promise;
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/today$/u);

    // The microphone that tap opened goes at once, while its start is still on its way.
    await expect
      .poll(() => microphoneRequests(page))
      .toStrictEqual([{ active: true, tracks: ["ended"] }]);

    await page.goBack();
    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

    release.resolve(null);
    await delivered.promise;

    // The full Main run reported ERR_ABORTED here after Leave; without its trace, the abort's
    // origin is unproved. Wait for the body to settle, then check what the learner sees: the late
    // answer never opens a call or takes them back. response() and body() also settle on failure.
    const heldStart = await held.promise;
    const answer = await heldStart.response();
    expect(answer, "the held start's answer reached the page").not.toBeNull();
    await answer?.body().catch(() => null);

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    await expect(page.getByRole("log", { name: "Conversation" })).toBeHidden();

    await expect(microphoneRequests(page)).resolves.toStrictEqual([
      { active: true, tracks: ["ended"] },
    ]);

    await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
    await page.getByRole("button", { name: "Start the call" }).click();
    await secondStart.promise;
    expect(requests.starts).toBe(2);

    await expect(
      page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
    ).toBeVisible();

    await expect(microphoneRequests(page)).resolves.toStrictEqual([
      { active: true, tracks: ["ended"] },
      { active: true, tracks: ["live"] },
    ]);
  } finally {
    release.resolve(null);
    await page.context().close();
  }
});

/**
 * Each microphone request, as a silent stream: whether the learner's tap was still active when it
 * was asked for, and whether its tracks are still live (let go once nothing uses them).
 */
async function watchMicrophone(page: Page) {
  await page.addInitScript(() => {
    const requests: { active: boolean; stream: MediaStream }[] = [];

    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        const active = navigator.userActivation.isActive;
        const context = new AudioContext();
        const silence = context.createConstantSource();
        const output = context.createMediaStreamDestination();
        silence.connect(output);
        silence.start();
        requests.push({ active, stream: output.stream });
        return Promise.resolve(output.stream);
      },
    });

    const read = () =>
      requests.map(({ active, stream }) => ({
        active,
        tracks: stream.getAudioTracks().map((track) => track.readyState),
      }));

    Object.assign(globalThis, { e2eMicrophoneRequests: read });
  });
}

async function microphoneRequests(page: Page) {
  return page.evaluate(() => {
    const read: unknown = Reflect.get(globalThis, "e2eMicrophoneRequests");

    const guard = {
      isRead(value: unknown): value is () => unknown {
        return typeof value === "function";
      },
    };

    if (!guard.isRead(read)) {
      throw new TypeError("Missing watched microphone");
    }

    return read();
  });
}
