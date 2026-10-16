import { type Page, type Request, type TestInfo } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { toUTCMidnight } from "@zoonk/utils/date";
import { openPaletteWithKeyboard } from "./command-palette";
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

      if (returnBeforeResponse) {
        await page.goBack();
        await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
      }

      release.resolve(null);
      await delivered.promise;

      // That start's answer reaches the page and loads in full before checking it changes nothing.
      // Neither wait can hang: response() is null if the browser dropped it, and body() settles
      // whether the load finishes or fails (finished() never settles on a failure).
      const heldStart = await held.promise;
      const answer = await heldStart.response();
      expect(answer, "the held start's answer reached the page").not.toBeNull();
      await answer?.body().catch(() => null);
      expect(heldStart.failure(), "the held start's answer loaded in full").toBeNull();

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

      await expect(microphoneRequests(page)).resolves.toStrictEqual([
        { active: true, tracks: ["ended"] },
        { active: true, tracks: ["live"] },
      ]);
    } finally {
      release.resolve(null);
      await page.context().close();
    }
  });
}

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

test("a checkpoint Start asks for the microphone in the tap, and its call keeps it", async ({
  browser,
}) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await answerLiveCalls(page, "answers");
  await watchMicrophone(page);
  await page.goto(`/checkpoint/${block.id}`);

  const held = Promise.withResolvers<null>();
  const release = Promise.withResolvers<null>();

  await page.route(`**/checkpoint/${block.id}`, async (route) => {
    if (route.request().method() !== "POST" || !route.request().postData()?.includes(block.id)) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    held.resolve(null);
    await release.promise;
    await route.fulfill({ response });
  });

  try {
    await page.getByRole("button", { name: "Start the call" }).click();
    await held.promise;

    // Asked for while the tap was still active, before the call even exists.
    await expect
      .poll(() => microphoneRequests(page))
      .toStrictEqual([{ active: true, tracks: ["live"] }]);

    release.resolve(null);

    await expect(
      page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
    ).toBeVisible();

    // The call goes on with that microphone instead of asking again.
    await expect(microphoneRequests(page)).resolves.toStrictEqual([
      { active: true, tracks: ["live"] },
    ]);
  } finally {
    release.resolve(null);
    await page.context().close();
  }
});

const STUDY_TIME_USED_UP = "You've reached today's study time. It'll be here tomorrow.";

/** The same line and way back as the French and German catalogs say them. */
const STUDY_TIME_USED_UP_IN = {
  de: {
    back: "Zurück zu Heute",
    line: "Du hast deine Lernzeit für heute erreicht. Morgen geht es hier weiter.",
  },
  fr: {
    back: "Retour à Aujourd'hui",
    line: "Tu as atteint ta limite de temps d’étude pour aujourd’hui. Ce sera de nouveau disponible demain.",
  },
} as const;

const CALL_DID_NOT_START = "The call didn't start. Try again in a moment.";

/** Today's study time under a 30-minute daily limit, all used. */
async function useUpTodaysStudyTime(userId: string) {
  await Promise.all([
    prisma.userLearningProfile.update({ data: { dailyLimitMinutes: 30 }, where: { userId } }),
    dailyProgressFixtureMany([
      { date: toUTCMidnight(new Date()), timeSpentSeconds: 30 * 60, userId },
    ]),
  ]);
}

/** The intro's footer once today's study time is used up: when the call is back, and the way home. */
async function expectStudyTimeUsedUp(page: Page) {
  await expect(page.getByRole("alert").filter({ hasText: STUDY_TIME_USED_UP })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
  await expect(page.getByText(CALL_DID_NOT_START)).toHaveCount(0);
}

test("a checkpoint opened past today's study time says when the call is back, with no Start to tap", async ({
  browser,
}, testInfo) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await watchMicrophone(page);
  await page.goto(`/checkpoint/${block.id}`);
  await expectStudyTimeUsedUp(page);

  // Nothing tapped, so nothing asked for the microphone.
  await expect(microphoneRequests(page)).resolves.toStrictEqual([]);
  await captureStartState(page, testInfo, "daily-limit");

  // The same line in French and German, on a phone.
  for (const lang of ["fr", "de"] as const) {
    const { back, line } = STUDY_TIME_USED_UP_IN[lang];
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await page.goto(`/${lang}/checkpoint/${block.id}`);
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await expect(page.getByRole("alert").filter({ hasText: line })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await expect(page.getByRole("link", { name: back })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await captureStartAt(page, testInfo, {
      colorScheme: "light",
      state: `daily-limit-${lang}`,
      width: 390,
    });
    // oxlint-disable-next-line no-await-in-loop -- One page shows one language at a time.
    await captureStartAt(page, testInfo, {
      colorScheme: "dark",
      state: `daily-limit-${lang}`,
      width: 390,
    });
  }

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/checkpoint/${block.id}`);
  await expect(microphoneRequests(page)).resolves.toStrictEqual([]);
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "pending" });

  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await page.context().close();
});

test("a checkpoint Start after today's study time ran out says so, as opening the page does", async ({
  browser,
}) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await watchMicrophone(page);
  await page.goto(`/checkpoint/${block.id}`);
  const start = page.getByRole("button", { name: "Start the call" });
  await expect(start).toBeVisible();

  // Meanwhile today's study time ran out.
  await useUpTodaysStudyTime(user.id);
  await start.click();
  await expectStudyTimeUsedUp(page);

  // The microphone the tap opened is let go: no call took it.
  await expect
    .poll(() => microphoneRequests(page))
    .toStrictEqual([{ active: true, tracks: ["ended"] }]);

  // The page says it, not just this screen: reading it again keeps it.
  await page.reload();
  await expectStudyTimeUsedUp(page);
  await expect(microphoneRequests(page)).resolves.toStrictEqual([]);
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  await page.context().close();
});

test("a checkpoint refused at today's study time offers Start again once the learner lifts the limit", async ({
  browser,
}) => {
  const { block, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  await today.getByRole("link", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));
  const start = page.getByRole("button", { name: "Start the call" });
  await expect(start).toBeVisible();

  await useUpTodaysStudyTime(user.id);
  await start.click();
  await expectStudyTimeUsedUp(page);
  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  // Every step stays in the app, so the checkpoint's screen is kept for coming back.
  const palette = await openPaletteWithKeyboard(page, /Search/iu);
  await palette.getByRole("combobox", { name: /Search/iu }).fill("language");
  await palette.getByRole("option", { name: /^Language/u }).click();
  await expect(page).toHaveURL(/\/settings\/appearance$/u);

  await page
    .getByRole("combobox", { name: "Daily time limit" })
    .selectOption({ label: "No limit" });

  await expect
    .poll(() => prisma.userLearningProfile.findUnique({ where: { userId: user.id } }))
    .toMatchObject({ dailyLimitMinutes: null });

  await page.getByRole("link", { name: /^Today/u }).click();
  await expect(page).toHaveURL(/\/today$/u);

  await today.getByRole("link", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));
  await expect(page.getByRole("button", { name: "Start the call" })).toBeEnabled();
  await expect(page.getByRole("alert").filter({ hasText: STUDY_TIME_USED_UP })).toHaveCount(0);
  await page.context().close();
});

test("a checkpoint Start after its call finished in another tab stays busy until its result opens", async ({
  browser,
}) => {
  const { block, boss, user } = await createLanguageChallenge({ final: false, plus: true });
  const page = await openAs(browser, user);
  await page.goto(`/checkpoint/${block.id}`);
  const start = page.getByRole("button", { name: "Start the call" });
  await expect(start).toBeVisible();

  // The same call, played and finished in another tab.
  const other = await page.context().newPage();
  const peer = await answerLiveCalls(other, "silent");
  await other.goto(`/challenge/${boss.id}`);
  await other.getByRole("button", { name: "Start the call" }).click();
  await peer.asked;
  /** The silent transport omits session.started; start it without any answers. */
  await peer.emit({ session: { id: "live_e2e" }, type: "session.started" });
  await expect(other.getByRole("status")).toHaveText(/^(?:Listening…|Microphone off)$/u);
  await other.getByRole("button", { exact: true, name: "End" }).click();
  await expect(other.getByRole("heading", { name: "Not this time" })).toBeVisible();
  await other.close();

  // From the tap on, Start never shows ready again and no failure shows, until the result opens. A
  // screen kept hidden after leaving doesn't count: only what's visible does.
  await start.evaluate((button, failure) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new TypeError("Start is not a button");
    }

    const seen = { busy: false, control: 0, failure: 0, readyAgain: 0, tapped: false };

    const readyStarts = () =>
      [button, ...document.querySelectorAll("button")].filter(
        (candidate) =>
          candidate instanceof HTMLButtonElement &&
          candidate.isConnected &&
          candidate.textContent.includes("Start the call") &&
          !candidate.disabled &&
          candidate.checkVisibility(),
      ).length;

    const look = () => {
      const ready = readyStarts() > 0;

      if (!seen.tapped) {
        seen.control += ready ? 1 : 0;
      } else if (!seen.busy) {
        seen.busy = !ready;
      } else if (ready) {
        seen.readyAgain += 1;
      }

      const shownFailures = [...document.querySelectorAll('[role="alert"]')].filter(
        (alert) => alert.textContent.includes(failure) && alert.checkVisibility(),
      );

      seen.failure += shownFailures.length;
    };

    button.addEventListener("click", () => {
      seen.tapped = true;
    });

    new MutationObserver(look).observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    Object.assign(globalThis, { e2eStartSeen: seen });
  }, CALL_DID_NOT_START);

  const readSeen = () =>
    page.evaluate(() => {
      const read: unknown = Reflect.get(globalThis, "e2eStartSeen");
      return read;
    });

  // The watch sees a ready Start: any change on the page while it's ready counts it.
  await page.evaluate(() => {
    document.body.dataset.e2eStartWatch = "on";
  });

  await expect
    .poll(async () => {
      const seen = await readSeen();
      return typeof seen === "object" && seen !== null && Number(Reflect.get(seen, "control")) > 0;
    })
    .toBe(true);

  await start.click();
  await expect(page).toHaveURL(/\/conversation\//u);
  await expect(page.getByRole("heading", { name: "Not this time" })).toBeVisible();

  await expect(readSeen()).resolves.toMatchObject({
    busy: true,
    failure: 0,
    readyAgain: 0,
    tapped: true,
  });

  await page.context().close();
});

test("a checkpoint Start after its day changed opens where it stands instead of offering a retry", async ({
  browser,
}) => {
  const { block, nextBlock, user } = await createLanguageChallenge({
    final: false,
    nextLessonTodo: true,
    plus: true,
  });

  const page = await openAs(browser, user);
  await page.goto(`/checkpoint/${block.id}`);
  const start = page.getByRole("button", { name: "Start the call" });
  await expect(start).toBeVisible();

  // Meanwhile the day changed: a lesson now comes before the challenge.
  await prisma.studySessionBlock.update({ data: { position: 2 }, where: { id: block.id } });

  await prisma.studySessionBlock.update({ data: { position: 0 }, where: { id: nextBlock?.id } });

  await start.click();
  await expect(page).toHaveURL(/\/today$/u);
  await expect(page.getByText("The call didn't start. Try again in a moment.")).toHaveCount(0);
  await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(0);
  await page.context().close();
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
