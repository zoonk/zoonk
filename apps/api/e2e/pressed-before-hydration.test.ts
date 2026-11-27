import { randomUUID } from "node:crypto";
import { expect, test } from "@zoonk/e2e/fixtures";
import { holdScripts } from "@zoonk/e2e/hydration";
import { cleanupVerifications, getOTPForEmail } from "./helpers/db";

test("an email sign-in pressed twice before hydration sends one code", async ({ page }) => {
  const email = `e2e-early-login-${randomUUID()}@zoonk.test`;
  const sends: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname === "/auth/en/login") {
      sends.push(request.url());
    }
  });

  try {
    const release = await holdScripts(page);
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    const next = page.getByRole("button", { name: /^continue$/iu });

    await page.getByLabel(/email/iu).fill(email);
    await next.click();
    await next.click();
    await expect(next).toHaveAttribute("data-held", "");
    expect(sends).toHaveLength(0);
    await release();

    await page.waitForURL(/\/auth\/en\/otp\?email=[^&]+$/u);
    await expect(getOTPForEmail(email)).resolves.toMatch(/^\d+$/u);
    expect(sends).toHaveLength(1);
  } finally {
    await cleanupVerifications(email);
  }
});
