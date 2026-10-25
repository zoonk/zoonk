import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createAuthenticatedApiContext } from "./helpers/auth";

test("central login keeps its form on an error and rejects a revoked cached session", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("The API E2E server must provide its base URL");
  }

  const { apiContext, user } = await createAuthenticatedApiContext({
    baseURL,
    prefix: "login-recovery",
  });
  // Populate the signed cookie cache, then keep those cookies after the database session is revoked.
  await apiContext.get("/v1/auth/get-session");

  const context = await browser.newContext({
    baseURL,
    storageState: await apiContext.storageState(),
  });

  const page = await context.newPage();

  try {
    await page.goto("/auth/login?error=expired");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByText("That sign-in expired. Try again.")).toBeVisible();

    await prisma.session.deleteMany({ where: { userId: user.id } });
    await page.goto("/auth/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/u);
    await expect(page.getByText("That sign-in expired. Try again.")).toBeHidden();
  } finally {
    await context.close();
    await apiContext.dispose();
  }
});
