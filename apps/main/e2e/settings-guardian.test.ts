import { prisma } from "@zoonk/db";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { type Page, expect, test } from "./fixtures";

/**
 * The learner's side of guardian links: a teen invites a guardian, sees the invite pending and
 * can cancel it, and sees an active guardian's daily limit and Plus approval. Adults don't need
 * one. Accepting and the guardian's controls live on the auth host (API e2e).
 */

const TEEN_BIRTH_YEAR = new Date().getUTCFullYear() - 15;

async function openGuardian(page: Page) {
  await page.goto("/settings/guardian");
  await expect(page.getByRole("heading", { level: 1, name: "Guardian" })).toBeVisible();
}

test.describe("Guardian settings", () => {
  test("a teen invites a guardian and can cancel the pending invite", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await learningProfileFixture({
      birthMonth: 1,
      birthYear: TEEN_BIRTH_YEAR,
      experienceMode: "focus",
      userId: noProgressUser.id,
    });

    await openGuardian(page);
    await page.getByRole("textbox", { name: "Your guardian's email" }).fill("mom@zoonk.test");
    await page.getByRole("button", { name: "Send invite" }).click();

    await expect(page.getByText("Invite sent. It works for 7 days.")).toBeVisible();
    await expect(page.getByText("mom@zoonk.test")).toBeVisible();

    await expect
      .poll(() => prisma.guardianLink.findFirst({ where: { userId: noProgressUser.id } }))
      .toMatchObject({ guardianEmail: "mom@zoonk.test", status: "pending" });

    await page.getByRole("button", { name: "Cancel invite" }).click();
    await expect(page.getByText("mom@zoonk.test")).toBeHidden();

    await expect
      .poll(() => prisma.guardianLink.findFirst({ where: { userId: noProgressUser.id } }))
      .toMatchObject({ status: "revoked" });
  });

  test("shows an active guardian's daily limit and Plus approval", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      learningProfileFixture({
        birthMonth: 1,
        birthYear: TEEN_BIRTH_YEAR,
        userId: noProgressUser.id,
      }),
      guardianLinkFixture({
        acceptedAt: new Date(),
        dailyLimitMinutes: 45,
        guardianEmail: "dad@zoonk.test",
        plusApprovedAt: new Date(),
        status: "active",
        userId: noProgressUser.id,
      }),
    ]);

    await openGuardian(page);

    await expect(page.getByText("dad@zoonk.test")).toBeVisible();
    await expect(page.getByText("Daily limit: 45 min")).toBeVisible();
    await expect(page.getByText("Plus approved")).toBeVisible();
    await expect(page.getByText("Only your guardian can end this link.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Invite another guardian" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Guardian" })).toBeVisible();
  });

  test("adults don't need a guardian", async ({ noProgressUser, userWithoutProgress: page }) => {
    await learningProfileFixture({ birthMonth: 1, birthYear: 1990, userId: noProgressUser.id });

    await openGuardian(page);

    await expect(page.getByText("Guardian links are for learners under 18.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send invite" })).toBeHidden();
  });
});
