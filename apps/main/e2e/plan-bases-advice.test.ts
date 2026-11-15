import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { type Page, expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** The plan is laid out by the day's first POST, as a learner's first visit to Today sends it. */
async function openStudyDay({ goalId, page }: { goalId: string; page: Page }) {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";
  const headers = { Origin: new URL(api).origin };

  const today = await page.request.get(`${api}/v1/today?goalId=${goalId}&timeZone=UTC`, {
    headers,
  });

  const { session } = await today.json();

  const opened = await page.request.post(`${api}/v1/goals/${goalId}/study-sessions`, {
    data: { keepEmpty: true, shownDate: session.localDate, timeZone: "UTC" },
    headers,
  });

  expect(opened.ok(), await opened.text()).toBe(true);
}

test("opening the prerequisites sheet asks once for the recommendation, and the page never asks", async ({
  browser,
}) => {
  const user = await createE2EUser(getBaseURL());

  const { goal } = await goalWithBasesFixture({
    days: 30,
    details: { answered: [...ONBOARDING_QUESTIONS, "buddy", "placement"], placementDeclined: true },
    kind: "exam",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  const page = await openAs(browser, user);
  await openStudyDay({ goalId: goal.id, page });
  const asked: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/plan/bases-advice")) {
      asked.push(request.method());
    }
  });

  await page.goto("/plan");
  await page.getByRole("button", { name: "Adjust plan" }).click();

  const prerequisites = page
    .getByRole("dialog", { name: "Adjust your plan" })
    .locator("[data-slot='plan-bases']");

  await expect(prerequisites).toBeVisible();
  expect(asked).toStrictEqual([]);

  await prerequisites.getByRole("button", { name: "Change" }).click();
  const sheet = page.getByRole("dialog", { name: "Prerequisites" });

  await expect(
    sheet.getByRole("radio", { name: /One short lesson each.*Recommended/u }),
  ).toBeVisible();

  await expect(
    sheet.getByText("Recommended", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);

  expect(asked).toStrictEqual(["POST"]);

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await prerequisites.getByRole("button", { name: "Change" }).click();

  await expect(
    sheet.getByRole("radio", { name: /One short lesson each.*Recommended/u }),
  ).toBeVisible();

  // The sheet's own check of a pick goes out after anything its opening started, so once it answers
  // a second ask would already have been sent.
  await sheet.getByText("Every lesson").click();
  await expect(sheet.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(asked).toStrictEqual(["POST"]);
});
