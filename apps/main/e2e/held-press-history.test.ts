import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated, holdScripts } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";

test.use({ launchOptions: { ignoreDefaultArgs: ["--disable-back-forward-cache"] } });

test("a held form press is cleared when leaving and doesn't send on going back", async ({
  page,
}, testInfo) => {
  const email = `leaving-${randomUUID()}@zoonk.test`;
  const sends: string[] = [];

  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/v1/feedback") {
      sends.push(request.url());
    }
  });

  const release = await holdScripts(page);

  await page.addInitScript(() => {
    window.addEventListener("pageshow", (event) => {
      document.documentElement.dataset.restoredFromCache = String(event.persisted);
    });
  });

  await page.goto("/support", { waitUntil: "domcontentloaded" });
  const send = page.getByRole("button", { name: "Send message" });
  await page.getByRole("textbox", { name: "Message" }).fill("A draft I'm leaving behind");
  await page.getByRole("textbox", { name: "Your email, for our reply" }).fill(email);
  await send.click();
  await expect(send).toHaveAttribute("data-held", "");

  const replayQueueLength = await send.evaluate((button) => {
    const { ownerDocument } = button;

    const queue = () => {
      const queued: unknown = Reflect.get(ownerDocument, "$$reactFormReplay");
      return Array.isArray(queued) ? queued.length : 0;
    };

    window.addEventListener(
      "pagehide",
      () => {
        sessionStorage.setItem(
          "leftSupport",
          JSON.stringify({ held: button.dataset.held !== undefined, queued: queue() }),
        );
      },
      { once: true },
    );

    return queue();
  });

  expect(replayQueueLength).toBeGreaterThan(0);

  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await release();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/support$/u);
  await expectHydrated(send);
  await expect(send).not.toHaveAttribute("data-held");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.restoredFromCache))
    .toBeDefined();

  const outcome = await page.evaluate(() => {
    const [entry] = performance.getEntriesByType("navigation");
    const notRestoredReasons: unknown = entry ? Reflect.get(entry, "notRestoredReasons") : null;

    return {
      navigationType: entry instanceof PerformanceNavigationTiming ? entry.type : null,
      notRestoredReasons,
      pagehide: sessionStorage.getItem("leftSupport"),
      persisted: document.documentElement.dataset.restoredFromCache,
    };
  });

  await testInfo.attach("history navigation", {
    body: JSON.stringify(outcome),
    contentType: "application/json",
  });

  expect(outcome.pagehide).toBe(JSON.stringify({ held: false, queued: 0 }));
  expect(sends).toHaveLength(0);
  await expect(prisma.feedback.count({ where: { email } })).resolves.toBe(0);
});
