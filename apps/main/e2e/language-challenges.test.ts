import { type Page, type TestInfo } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
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

// oxlint-disable-next-line vitest/prefer-each -- Playwright doesn't provide test.each.
for (const final of [false, true]) {
  test(`a Free learner with exhausted calls sees the ${final ? "final" : "phase"} challenge locked and finishes the lesson plan`, async ({
    browser,
  }, testInfo) => {
    const { block, boss, user } = await createLanguageChallenge({ final });

    await usageRecordsFixture({
      count: 1,
      kind: "conversation",
      seconds: EXHAUSTED_CALL_SECONDS,
      userId: user.id,
    });

    const page = await openAs(browser, user);

    if (final) {
      await page.setViewportSize({ height: 844, width: 390 });
    }

    await page.goto(`/checkpoint/${block.id}`);
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

    await expect(
      page.getByRole("heading", { level: 1, name: RENTING_SCENARIO.title }),
    ).toBeVisible();

    await expect(page.getByText("Book a viewing")).toBeVisible();
    await expect(page.getByText("Available with Plus")).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Challenge passed" })).toHaveCount(0);
    await expectNoChallengeSpend(user.id);
    await page.screenshot({ path: testInfo.outputPath("free-locked-call-intro.png") });

    await page.getByRole("link", { name: "See Plus" }).click();
    await expect(page).toHaveURL(/\/subscription$/u);
    await page.goto("/plan");
    await expect(page.getByRole("button", { exact: true, name: "Pace Finished" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("free-finished-plan.png") });
    await page.goto("/today");
    await expect(page.getByText(/Plan finished/u)).toBeVisible();

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    await expectNoChallengeSpend(user.id);

    await page.goto(`/challenge/${boss.id}`);
    await expect(page.getByText("Available with Plus")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Challenge passed" })).toHaveCount(0);
    await expectNoChallengeSpend(user.id);
    await page.context().close();
  });
}

test("a Free learner can open the next lesson while the earlier call challenge stays locked", async ({
  browser,
}, testInfo) => {
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
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Pace Finished" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "You finished your plan" })).toHaveCount(0);

  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  const lessonName = `${nextLesson?.title}, counts toward a mission`;
  await expect(today.getByRole("button", { exact: true, name: lessonName })).toBeVisible();
  await today.getByRole("button", { name: /^Start session/u }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${nextLesson?.id}\\?session=`, "u"));
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("free-next-lesson.png") });

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: nextBlock?.id } }),
  ).resolves.toMatchObject({ status: "active" });

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ startedAt: null, status: "pending" });

  await expectNoChallengeSpend(user.id);
  await page.context().close();
});

test("a Plus learner's written challenge creates its call only on Start", async ({
  browser,
}, testInfo) => {
  const { block, boss, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await answerLiveCalls(page, "answers");

  await page.goto(`/challenge/${boss.id}`);
  await expect(page.getByText("Book a viewing")).toBeVisible();
  await expect(page.getByText("Available with Plus")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "The Trickster" })).toHaveCount(0);
  await expect(page.getByText(/\d+ questions/u)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("plus-call-intro.png") });

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
  await page.screenshot({ path: testInfo.outputPath("completed-call-after-lapse.png") });

  await page.context().close();
});

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each.
for (const returnBeforeResponse of [true, false]) {
  test(`leaving cancels a checkpoint Start resolved ${returnBeforeResponse ? "after" : "before"} returning`, async ({
    browser,
  }) => {
    const { block, user } = await createLanguageChallenge({ final: false, plus: true });
    const page = await openAs(browser, user);
    await answerLiveCalls(page, "answers");
    await page.goto(`/checkpoint/${block.id}`);
    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

    const held = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();
    const delivered = Promise.withResolvers<null>();
    const secondStart = Promise.withResolvers<null>();
    const requests = { starts: 0 };

    const firstResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        Boolean(response.request().postData()?.includes(block.id)),
    );

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
      held.resolve(null);
      await release.promise;
      await route.fulfill({ response });
      delivered.resolve(null);
    });

    try {
      await page.getByRole("button", { name: "Start the call" }).click();
      await held.promise;
      await page.getByRole("link", { name: "Leave" }).click();
      await expect(page).toHaveURL(/\/today$/u);

      if (returnBeforeResponse) {
        await page.goBack();
        await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
      }

      release.resolve(null);
      await delivered.promise;
      const response = await firstResponse;
      await response.finished();

      if (!returnBeforeResponse) {
        await page.goBack();
      }

      await expect(prisma.liveCallConnection.count({ where: { userId: user.id } })).resolves.toBe(
        0,
      );

      await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
      await page.getByRole("button", { name: "Start the call" }).click();
      await secondStart.promise;
      expect(requests.starts).toBe(2);

      await expect(
        page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
      ).toBeVisible();
    } finally {
      release.resolve(null);
      await page.context().close();
    }
  });
}

async function captureStartAt(
  page: Page,
  testInfo: TestInfo,
  { colorScheme, state, width }: { colorScheme: "dark" | "light"; state: string; width: number },
) {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ height: 900, width });

  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`checkpoint-call-${state}-${width}-${colorScheme}.png`),
  });
}

/** A Start state on the action bar, on a phone and a laptop, light and dark. */
async function captureStartState(page: Page, testInfo: TestInfo, state: string) {
  await captureStartAt(page, testInfo, { colorScheme: "light", state, width: 390 });
  await captureStartAt(page, testInfo, { colorScheme: "dark", state, width: 390 });
  await captureStartAt(page, testInfo, { colorScheme: "light", state, width: 1440 });
  await captureStartAt(page, testInfo, { colorScheme: "dark", state, width: 1440 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("a checkpoint Start says it's starting, keeps its intro when it fails and starts at once after leaving", async ({
  browser,
}, testInfo) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await answerLiveCalls(page, "answers");
  await page.goto(`/checkpoint/${block.id}`);

  const start = page.getByRole("button", { name: "Start the call" });
  const greeting = page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling");

  const problem = page
    .getByRole("alert")
    .filter({ hasText: "The call didn't start. Try again in a moment." });

  await expect(start).toBeVisible();

  // The first start never reaches the server; the second answers only after the learner left
  // and came back; the next one goes through at once.
  const failing = { held: Promise.withResolvers<null>(), release: Promise.withResolvers<null>() };

  const abandoned = {
    delivered: Promise.withResolvers<null>(),
    held: Promise.withResolvers<null>(),
    release: Promise.withResolvers<null>(),
  };

  const requests = { starts: 0 };

  await page.route(`**/checkpoint/${block.id}`, async (route) => {
    if (route.request().method() !== "POST" || !route.request().postData()?.includes(block.id)) {
      await route.continue();
      return;
    }

    requests.starts += 1;

    if (requests.starts === 1) {
      failing.held.resolve(null);
      await failing.release.promise;
      await route.abort();
      return;
    }

    if (requests.starts === 2) {
      const response = await route.fetch();
      abandoned.held.resolve(null);
      await abandoned.release.promise;
      await route.fulfill({ response });
      abandoned.delivered.resolve(null);
      return;
    }

    await route.continue();
  });

  try {
    await start.click();
    await failing.held.promise;
    await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();
    await captureStartState(page, testInfo, "starting");
    failing.release.resolve(null);

    await expect(problem).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: RENTING_SCENARIO.title }),
    ).toBeVisible();

    await expect(start).toBeEnabled();
    await captureStartState(page, testInfo, "start-failed");

    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );

    await start.click();
    await abandoned.held.promise;
    await expect(problem).toHaveCount(0);
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await page.goBack();

    // Back before that start answered: Start is ready again, and one tap opens the call.
    await start.click();
    await expect(greeting).toBeVisible();
    expect(requests.starts).toBe(3);

    abandoned.release.resolve(null);
    await abandoned.delivered.promise;
    await expect(greeting).toBeVisible();

    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      1,
    );
  } finally {
    failing.release.resolve(null);
    abandoned.release.resolve(null);
    await page.context().close();
  }
});

test("a learner whose Plus lapses while the call intro is open sees the lock on Start", async ({
  browser,
}) => {
  const { boss, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  await page.getByRole("button", { name: "Start the call" }).click();

  await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
    "href",
    "/subscription",
  );

  await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  await expect(prisma.aiCall.count({ where: { userId: user.id } })).resolves.toBe(0);
  await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  await page.context().close();
});

test("an unstarted checkpoint bookmark shows the Plus lock after the subscription lapses", async ({
  browser,
}, testInfo) => {
  const { block, nextLesson, user } = await createLanguageChallenge({
    final: false,
    nextLessonTodo: true,
    plus: true,
  });

  const page = await openAs(browser, user);
  await page.goto(`/checkpoint/${block.id}`);
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  const bookmark = page.url();

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  await page.goto(bookmark);

  await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
    "href",
    "/subscription",
  );

  await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("lapsed-call-bookmark.png") });
  await expect(prisma.aiCall.count({ where: { userId: user.id } })).resolves.toBe(0);
  await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);

  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  await today.getByRole("button", { name: /^(?:Start|Continue) session/u }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${nextLesson?.id}\\?session=`, "u"));
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

  await page.context().close();
});

test("a lost challenge result stays readable after Plus lapses and offers Plus for another call", async ({
  browser,
}, testInfo) => {
  const { block, boss, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  const peer = await answerLiveCalls(page, "silent");
  await page.goto(`/challenge/${boss.id}`);
  await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
  await page.getByRole("button", { name: "Start the call" }).click();
  await peer.asked;
  /** The silent transport omits session.started; start it without any answers. */
  await peer.emit({ session: { id: "live_e2e" }, type: "session.started" });
  await expect(page.getByRole("status")).toHaveText(/^(?:Listening…|Microphone off)$/u);
  await page.getByRole("button", { exact: true, name: "End" }).click();
  await expect(page.getByRole("heading", { name: "Not this time" })).toBeVisible();

  await expect(
    page.getByText("Nothing is lost: the call comes back so you can try again."),
  ).toBeVisible();

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  await page.goto(`/checkpoint/${block.id}`);
  await expect(page).toHaveURL(/\/conversation\//u);
  await expect(page.getByRole("heading", { name: "Not this time" })).toBeVisible();
  await expect(page.getByText("Available with Plus")).toBeVisible();

  await expect(
    page.getByText("Challenge calls come with Plus. Your plan keeps going without them."),
  ).toBeVisible();

  await expect(
    page.getByText("Nothing is lost: the call comes back so you can try again."),
  ).toHaveCount(0);

  const plus = page.getByRole("link", { name: "See Plus" });
  await expect(plus).toHaveAttribute("href", "/subscription");

  await page.setViewportSize({ height: 1000, width: 390 });
  await expect(page.getByRole("heading", { name: "Not this time" })).toBeVisible();

  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("lost-call-plus-390.png"),
  });

  await page.setViewportSize({ height: 1000, width: 1440 });
  await expect(page.getByRole("heading", { name: "Not this time" })).toBeVisible();

  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath("lost-call-plus-1440.png"),
  });

  await plus.click();
  await expect(page).toHaveURL(/\/subscription$/u);
  await page.context().close();
});
