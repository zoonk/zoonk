import { randomUUID } from "node:crypto";
import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

test("hydrates a focused request form and lets a suggestion fill the editable draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/start/learn");
  const input = page.getByRole("textbox", { name: "What do you want to learn?" });
  await expect(input).toBeFocused();
  const suggestions = page.getByRole("navigation", { name: "Suggested subjects" });
  const subjects = await suggestions.getByRole("button").allTextContents();
  expect(subjects.length).toBeGreaterThan(0);
  const selected = subjects[0]!;
  await suggestions.getByRole("button", { exact: true, name: selected }).click();
  await expect(input).toHaveValue(selected);
  await expect(input).toBeFocused();
  await expect(page).toHaveURL("/start/learn");
  await page.reload();
  await expect(input).toHaveValue(selected);
  expect(errors).toEqual([]);
});

test("keeps a personal guest request out of the URL and preserves it through sign-in navigation", async ({
  page,
}) => {
  const prompt = `Help me prepare a private family project ${randomUUID()}`;
  await page.goto("/start/learn");
  const input = page.getByRole("textbox", { name: "What do you want to learn?" });
  await input.fill(prompt);
  await input.press("Enter");
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toBeVisible();
  await expect(page).toHaveURL("/start/learn");
  expect(await prisma.courseDiscovery.count({ where: { prompt } })).toBe(0);
  expect(await prisma.coursePrompt.count({ where: { prompt } })).toBe(0);

  await page.route("**/auth/login**", (route) =>
    route.fulfill({ body: "Auth service", contentType: "text/html" }),
  );

  const authRequest = page.waitForRequest("**/auth/login**");
  await page.getByRole("link", { name: "Sign in to continue" }).click();
  const request = await authRequest;
  await expect(page.getByText("Auth service", { exact: true })).toBeVisible();
  const authUrl = new URL(request.url());
  const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");
  expect(callbackUrl.searchParams.get("next")).toBe("/start/learn");
  expect(authUrl.href).not.toContain(encodeURIComponent(prompt));
  await page.goto("/start/learn");
  await expect(input).toHaveValue(prompt);
});

test("disables submission while routing and retains the request after a network failure", async ({
  page,
}) => {
  const prompt = `A personal learning goal ${randomUUID()}`;
  await page.goto("/start/learn");
  const input = page.getByRole("textbox", { name: "What do you want to learn?" });
  const submit = page.getByRole("button", { name: "Find my next step" });
  const requestStarted = Promise.withResolvers<null>();
  const finishRequest = Promise.withResolvers<null>();

  await page.route("**/start/learn", async (route) => {
    if (!route.request().headers()["next-action"]) {
      await route.continue();
      return;
    }

    requestStarted.resolve(null);
    await finishRequest.promise;
    await route.abort("failed");
  });

  await input.fill(prompt);
  await submit.click();
  await requestStarted.promise;

  try {
    await expect(submit).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Finding a useful place to start…");
    await expect(input).toHaveValue(prompt);
  } finally {
    finishRequest.resolve(null);
  }

  await expect(
    page.getByRole("alert").filter({ hasText: "We couldn't prepare your next step" }),
  ).toBeVisible();

  await expect(input).toHaveValue(prompt);
  await expect(submit).toBeEnabled();
  await page.unroute("**/start/learn");
  await submit.click();
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toBeVisible();
});

test("guests can find an already generated exact subject and choose their starting point", async ({
  page,
}) => {
  const organization = await getAiOrganization();
  const title = `A reusable subject ${randomUUID()}`;

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    title,
  });

  await page.goto("/start/learn");
  await page.getByRole("textbox", { name: "What do you want to learn?" }).fill(course.title);
  await page.getByRole("button", { name: "Find my next step" }).click();
  await expect(page).toHaveURL(`/b/ai/c/${course.slug}/start`);
  await expect(page.getByRole("group", { name: "How would you like to learn?" })).toBeVisible();
  expect(await prisma.courseLearningPlan.count({ where: { courseId: course.id } })).toBe(0);
});

test("an existing narrow question opens its course directly without a broad-course questionnaire", async ({
  page,
}) => {
  const organization = await getAiOrganization();
  const title = `Why is this useful ${randomUUID()}`;

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    format: "question",
    isPublished: true,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    title,
  });

  await page.goto("/start/learn");
  await page.getByRole("textbox", { name: "What do you want to learn?" }).fill(course.title);
  await page.getByRole("button", { name: "Find my next step" }).click();
  await expect(page).toHaveURL(`/b/ai/c/${course.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
});

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const { legacyPrompt, prefix } of [
  { legacyPrompt: "100% attention", prefix: "/start/learn" },
  { legacyPrompt: "paths / and + and #", prefix: "/start/learn" },
  { legacyPrompt: "literal %20 and %2F", prefix: "/start/learn" },
  { legacyPrompt: "100% attention", prefix: "/learn" },
]) {
  test(`a ${prefix} bookmark preserves ${legacyPrompt} without starting generation`, async ({
    authenticatedPage: page,
  }) => {
    const prompt = `My personal goal with ${legacyPrompt} ${randomUUID()}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/start/learn");
    await page.getByRole("textbox", { name: "What do you want to learn?" }).fill("Older draft");
    await page.goto(`${prefix}/${encodeURIComponent(prompt)}`);
    await expect(page).toHaveURL("/start/learn");

    await expect(page.getByRole("textbox", { name: "What do you want to learn?" })).toHaveValue(
      prompt,
    );

    await expect(page.getByRole("textbox", { name: "What do you want to learn?" })).toBeFocused();
    await page.reload();

    await expect(page.getByRole("textbox", { name: "What do you want to learn?" })).toHaveValue(
      prompt,
    );

    expect(await prisma.courseDiscovery.count({ where: { prompt } })).toBe(0);
    expect(await prisma.coursePrompt.count({ where: { prompt } })).toBe(0);
    expect(errors).toEqual([]);
  });
}
