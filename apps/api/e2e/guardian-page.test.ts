import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { toUTCMidnight } from "@zoonk/utils/date";
import { createTeenInvite, openAsGuardian } from "./helpers/guardian";

/**
 * The guardian's page on the auth host: sign in, accept a teen's invite, see their week, set a
 * daily time limit and approve Plus.
 */

const TWENTY_MINUTES_IN_SECONDS = 1200;

test.describe("Guardian page", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("asks a visitor to sign in and keeps the invite for after", async ({ page }) => {
    await page.goto("/auth/guardian?token=invite-token");

    const signIn = page.getByRole("link", { name: "Sign in to continue" });
    await expect(signIn).toBeVisible();

    const href = new URL((await signIn.getAttribute("href"))!, baseURL);
    const redirectTo = new URL(href.searchParams.get("redirectTo")!);

    expect(href.pathname).toBe("/auth/login");
    expect(redirectTo.pathname).toBe("/auth/guardian");
    expect(redirectTo.searchParams.get("invite")).toBe("invite-token");
  });

  test("accepts an invite, sets a daily limit and approves Plus", async ({ browser }) => {
    const { context, guardian, page } = await openAsGuardian({ baseURL, browser });
    const { learner, token } = await createTeenInvite({ baseURL, guardianEmail: guardian.email });

    await prisma.dailyProgress.create({
      data: {
        date: toUTCMidnight(new Date()),
        dayOfWeek: new Date().getUTCDay(),
        lessonsCompleted: 2,
        timeSpentSeconds: TWENTY_MINUTES_IN_SECONDS,
        userId: learner.id,
      },
    });

    await page.goto(`/auth/guardian?token=${token}`);
    await expect(page.getByRole("heading", { name: "Accept the invite" })).toBeVisible();
    await page.getByRole("button", { name: "Accept invite" }).click();

    await expect(page.getByRole("heading", { name: "Your learners" })).toBeVisible();
    await expect(page.getByText(/Invite accepted/u)).toBeVisible();

    const card = page.getByRole("region", { name: learner.name });
    await expect(card.getByText("Last 7 days: 20 minutes and 2 lessons")).toBeVisible();

    const week = card.getByRole("list", { name: "Minutes each day" });
    await expect(week.getByRole("listitem")).toHaveCount(7);
    await expect(week.getByText(/: 20 minutes, 2 lessons$/u)).toBeAttached();

    await card
      .getByRole("combobox", { name: "Daily time limit" })
      .selectOption({ label: "45 min a day" });

    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Daily limit saved")).toBeVisible();

    await card.getByRole("button", { name: "Approve Plus" }).click();
    await expect(card.getByText(/You approved Plus on/u)).toBeVisible();

    await expect(
      prisma.guardianLink.findFirstOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({
      dailyLimitMinutes: 45,
      plusApprovedAt: expect.any(Date),
      status: "active",
    });

    await card.getByRole("button", { name: "End link" }).click();

    const confirm = page.getByRole("alertdialog", {
      name: `Stop being ${learner.name}'s guardian?`,
    });

    await confirm.getByRole("button", { name: "End link" }).click();

    await expect(
      page.getByText("No learner has invited you yet. Invites arrive by email."),
    ).toBeVisible();

    await expect(
      prisma.guardianLink.findFirstOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ status: "revoked" });

    await context.close();
  });

  test("refuses an invite sent to another email", async ({ browser }) => {
    const { context, page } = await openAsGuardian({ baseURL, browser });

    const { learner, token } = await createTeenInvite({
      baseURL,
      guardianEmail: "someone-else@zoonk.test",
    });

    await page.goto(`/auth/guardian?token=${token}`);
    await page.getByRole("button", { name: "Accept invite" }).click();

    await expect(page.getByText(/This invite was sent to another email/u)).toBeVisible();

    await expect(
      prisma.guardianLink.findFirstOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await context.close();
  });
});
