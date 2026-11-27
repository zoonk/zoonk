import { randomUUID } from "node:crypto";
import { type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectHydrated, holdScripts } from "@zoonk/e2e/hydration";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

function isFeedbackSend(request: Request) {
  return request.method() === "POST" && new URL(request.url()).pathname === "/v1/feedback";
}

/** A Server Action posts to the page it runs on. */
function isActionOn(path: string) {
  return (request: Request) =>
    request.method() === "POST" &&
    new URL(request.url()).pathname === path &&
    Boolean(request.headers()["next-action"]);
}

function isOnboardingAnswer({ path, question }: { path: string; question: string }) {
  const isAction = isActionOn(path);

  return (request: Request) =>
    isAction(request) && (request.postData()?.includes(`"question":"${question}"`) ?? false);
}

function count(page: Page, matches: (request: Request) => boolean) {
  const sent: Request[] = [];

  page.on("request", (request) => {
    if (matches(request)) {
      sent.push(request);
    }
  });

  return sent;
}

async function openOnboardingStep(userId: string, step: "buddy" | "schedule") {
  const goal = await createMappedGoal(userId);
  const answered = [...ANSWERED.filter((question) => question !== step), "placement"];

  await prisma.goal.update({
    data: { details: { answered, subject: "algebra" } },
    where: { id: goal.id },
  });

  return goal;
}

test.describe("Presses made before the page hydrates", () => {
  test("a help message sent twice goes out once, with the words it had at the first press", async ({
    page,
  }) => {
    const email = `early-${randomUUID()}@zoonk.test`;
    const sent = `The lesson froze on my phone ${randomUUID()}`;
    const typedAfter = `${sent}, and then the app closed`;
    const sends = count(page, isFeedbackSend);
    const release = await holdScripts(page);

    await page.goto("/support", { waitUntil: "domcontentloaded" });
    const message = page.getByRole("textbox", { name: "Message" });
    const send = page.getByRole("button", { name: "Send message" });

    await message.fill(sent);
    await page.getByRole("textbox", { name: "Your email, for our reply" }).fill(email);
    await send.click();
    await expect(send).toHaveAttribute("aria-busy", "true");

    await message.fill(typedAfter);
    await send.click();
    await release();

    await expect(
      page.getByText("Message sent successfully! We'll get back to you soon."),
    ).toBeVisible();

    await expect(message).toHaveValue(typedAfter);

    await expect
      .poll(() => prisma.feedback.findMany({ select: { message: true }, where: { email } }))
      .toStrictEqual([{ message: sent }]);

    expect(sends).toHaveLength(1);
  });

  // Each page's own content streams in its own Suspense boundary, which hydrates after the rest.
  test("a switch, a dialog and a menu in a part that hydrates after the rest each act once", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const statement = `Practices on the train ${randomUUID().slice(0, 6)}`;
    await memoryFactFixture({ statement, userId: noProgressUser.id });
    const usageSaves = count(page, isActionOn("/settings/privacy"));
    const releasePrivacy = await holdScripts(page);

    await page.goto("/settings/privacy", { waitUntil: "domcontentloaded" });
    const usage = page.getByRole("switch", { name: "Share usage data" });
    const remove = page.getByRole("button", { name: "Delete account" });
    const sharing = (await usage.getAttribute("aria-checked")) === "true";

    await usage.click();
    await remove.click();
    await usage.click();
    await expect(usage).toHaveAttribute("aria-busy", "true");
    await expect(remove).toHaveAttribute("aria-busy", "true");
    await releasePrivacy();

    const confirm = page.getByRole("alertdialog", { name: "Delete your account?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(usage).toHaveAttribute("aria-checked", String(!sharing));

    await expect
      .poll(() =>
        prisma.userLearningProfile.findUnique({
          select: { shareUsageData: true },
          where: { userId: noProgressUser.id },
        }),
      )
      .toStrictEqual({ shareUsageData: !sharing });

    expect(usageSaves).toHaveLength(1);

    // A menu opens on the press itself, as a select does, so its held click must still open it.
    const releaseMemory = await holdScripts(page);
    await page.goto("/settings/memory", { waitUntil: "domcontentloaded" });
    const options = page.getByRole("button", { name: `Options for “${statement}”` });

    await options.click();
    await expect(options).toHaveAttribute("aria-busy", "true");
    await releaseMemory();

    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  });

  test("Enter and repeated Continue presses save the buddy name once without navigating", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await openOnboardingStep(noProgressUser.id, "buddy");
    const path = `/start/${goal.id}`;
    const isAnswer = isOnboardingAnswer({ path, question: "buddy" });
    const saves = count(page, isAnswer);

    const submissions = count(page, (request) => {
      const url = new URL(request.url());

      return (
        request.isNavigationRequest() &&
        request.method() === "GET" &&
        url.pathname === path &&
        request.url().includes("?")
      );
    });

    const release = await holdScripts(page);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    const next = page.getByRole("button", { exact: true, name: "Continue" });

    await name.fill("Pip");
    await name.press("Enter");
    await expect(next).toHaveAttribute("data-held", "");
    await next.click();
    await next.click();
    expect(submissions).toHaveLength(0);
    expect(saves).toHaveLength(0);

    const [saved] = await Promise.all([
      page.waitForResponse((response) => isAnswer(response.request())),
      release(),
    ]);

    expect(saved.ok()).toBe(true);

    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeHidden();

    await expect
      .poll(() =>
        prisma.userLearningProfile.findUnique({
          select: { buddyName: true },
          where: { userId: noProgressUser.id },
        }),
      )
      .toEqual({ buddyName: "Pip" });

    expect(submissions).toHaveLength(0);
    expect(saves).toHaveLength(1);
  });

  test("an early memory switch press shows the new setting and saves it once", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const path = "/settings/memory";
    const saves = count(page, isActionOn(path));
    const release = await holdScripts(page);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    const memory = page.getByRole("switch", { name: "Use memory" });
    await expect(memory).toBeChecked();

    await memory.click();
    await memory.click();
    await expect(memory).toHaveAttribute("data-held", "unchecked");
    expect(saves).toHaveLength(0);
    await release();

    await expect(memory).not.toBeChecked();
    await expect(memory).not.toHaveAttribute("data-held");

    await expect
      .poll(() =>
        prisma.userLearningProfile.findUnique({
          select: { memoryEnabled: true },
          where: { userId: noProgressUser.id },
        }),
      )
      .toEqual({ memoryEnabled: false });

    expect(saves).toHaveLength(1);
  });

  test("a daily time picked early is shown immediately and saved once", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await openOnboardingStep(noProgressUser.id, "schedule");
    const path = `/start/${goal.id}`;
    const isAnswer = isOnboardingAnswer({ path, question: "schedule" });
    const saves = count(page, isAnswer);
    const release = await holdScripts(page);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    const time = page.getByLabel("Time a day", { exact: true });
    const next = page.getByRole("button", { exact: true, name: "Continue" });
    await time.selectOption("45");
    await expect(page.getByText("45 min", { exact: true }).filter({ visible: true })).toBeVisible();

    expect(saves).toHaveLength(0);
    await release();

    await expectHydrated(time);
    await expect(time).toHaveValue("45");

    const [saved] = await Promise.all([
      page.waitForResponse((response) => isAnswer(response.request())),
      next.click(),
    ]);

    expect(saved.ok()).toBe(true);
    await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();

    await expect
      .poll(() =>
        prisma.goal.findUnique({ select: { dailyMinutes: true }, where: { id: goal.id } }),
      )
      .toEqual({ dailyMinutes: 45 });

    expect(saves).toHaveLength(1);
  });

  test("two early lesson taps advance one screen without moving focus to its action", async ({
    browser,
    noProgressUser,
  }) => {
    const { lesson } = await playableLessonFixture({
      steps: [
        {
          content: {
            text: "A cloud shows where the electron is likely to be.",
            title: "A cloud, not a little ball",
          },
          kind: "explanation",
        },
        {
          content: { text: "Read the darker areas first.", title: "Reading the cloud" },
          kind: "explanation",
        },
        "check",
      ],
    });

    const context = await browser.newContext({
      hasTouch: true,
      storageState: noProgressUser.storageState,
    });

    const page = await context.newPage();
    const path = `/learn/${lesson.id}`;

    const starts = count(
      page,
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === `/api/library/lessons/${lesson.id}/starts`,
    );

    const release = await holdScripts(page);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    const next = page.getByRole("button", { name: /^Continue/u });
    await next.tap();
    await next.tap();
    await expect(next).toHaveAttribute("data-held", "");
    expect(starts).toHaveLength(0);
    await release();

    await expect(page.getByText("Reading the cloud", { exact: true })).toBeVisible();

    await expect(
      page.getByText('What does the electron "cloud" show?', { exact: true }),
    ).toBeHidden();

    await expect
      .poll(() => page.evaluate(() => document.activeElement === document.body))
      .toBe(true);

    await expect.poll(() => starts.length).toBe(1);
    await context.close();
  });

  test("an early Cancel Plus press opens only the confirmation", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const saved = await prisma.subscription.create({
      data: {
        periodEnd: new Date(Date.now() + 86_400_000),
        periodStart: new Date(),
        plan: "plus",
        provider: "stripe",
        referenceId: noProgressUser.id,
        status: "active",
        stripeCustomerId: `cus_test_e2e_${randomUUID()}`,
        stripeSubscriptionId: `sub_test_e2e_${randomUUID()}`,
      },
    });

    const path = "/subscription";
    const cancellations = count(page, isActionOn(path));
    const release = await holdScripts(page);

    await page.goto(path, { waitUntil: "domcontentloaded" });
    const cancel = page.getByRole("button", { exact: true, name: "Cancel Plus" });
    await cancel.click();
    await cancel.click();
    await expect(cancel).toHaveAttribute("data-held", "");
    await release();

    const confirm = page.getByRole("alertdialog", { name: "Cancel Plus?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep Plus" }).click();
    await expect(confirm).toBeHidden();

    expect(cancellations).toHaveLength(0);

    await expect(
      prisma.subscription.findUnique({ where: { id: saved.id } }),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: false, status: "active" });
  });

  test("a held press is dropped when its control hydrates disabled", async ({ page }) => {
    const sends = count(
      page,
      (request) => request.method() === "POST" && Boolean(request.headers()["next-action"]),
    );

    const release = await holdScripts(page);
    await page.goto("/courses", { waitUntil: "domcontentloaded" });

    const field = page.getByRole("textbox", { name: "I want to" });
    const send = page.getByRole("button", { exact: true, name: "Build my plan" });
    // Native required validation allows a space; the app disables the button for a blank goal.
    await field.fill(" ");
    await send.click();
    await expect(send).toHaveAttribute("data-held", "");
    await release();

    await expect(send).toBeDisabled();
    await expect(send).not.toHaveAttribute("data-held");
    await expect(page).toHaveURL(/\/courses$/u);
    expect(sends).toHaveLength(0);
  });
});
