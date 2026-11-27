import { randomUUID } from "node:crypto";
import { type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { holdScripts } from "@zoonk/e2e/hydration";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { expect, test } from "./fixtures";

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

function count(page: Page, matches: (request: Request) => boolean) {
  const sent: Request[] = [];

  page.on("request", (request) => {
    if (matches(request)) {
      sent.push(request);
    }
  });

  return sent;
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
});
