import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { openLearnerPalette, openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

test.describe("Palette search", () => {
  test("a chapter in the learner's plan appears once, ahead of the catalog", async ({
    browser,
  }) => {
    const [user, catalog] = await Promise.all([
      createE2EUser(getBaseURL()),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const chapter = catalog.chapters[0]!;
    const title = `Palette plan ${randomUUID()}`;

    await prisma.chapter.update({
      data: { normalizedTitle: normalizeString(title), title },
      where: { id: chapter.id },
    });

    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    const skill = await skillFixture({ name: "Palette search skill" });

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Foundations" }],
        skills: [
          {
            area: "Palette course",
            courseIds: [catalog.course.id],
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
          },
        ],
      },
    });

    await Promise.all([
      planItemFixture({
        chapterId: chapter.id,
        completedAt: new Date(),
        lessonId: catalog.lessons[0]![0]!.id,
        planId: plan.id,
        skillId: skill.id,
        status: "done",
      }),
      lessonSkillFixture({ lessonId: catalog.lessons[0]![0]!.id, skillId: skill.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);

    try {
      await page.goto("/plan");
      const palette = await openPaletteWithKeyboard(page);
      await palette.getByRole("combobox", { name: /Search/iu }).fill(title);

      await expect(
        palette
          .getByRole("group", { name: "Your plan" })
          .getByRole("option", { name: new RegExp(`^${title}`, "u") }),
      ).toBeVisible();

      await expect(palette.locator(`a[href$="/ch/${chapter.slug}"]`)).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("settings finds its pages in Go to before catalog matches", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/today");
      const palette = await openPaletteWithKeyboard(page);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("settings");
      const destinations = palette.getByRole("group", { name: "Go to" });

      for (const name of [
        "Settings",
        "Profile",
        "Memory",
        "Subscription",
        "Preferences",
        "Language",
      ]) {
        // oxlint-disable-next-line no-await-in-loop -- Each destination must survive the same query.
        await expect(
          destinations.getByRole("option", { name: new RegExp(`^${name}`, "u") }),
        ).toBeVisible();
      }

      const settings = destinations.getByRole("option", { name: /^Settings/u });

      await expect(palette.getByRole("combobox", { name: /Search/iu })).toHaveAttribute(
        "aria-activedescendant",
        (await settings.getAttribute("id"))!,
      );

      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/settings$/u);
      await expect(palette).toBeHidden();
    });
  });

  test("percent keeps Continue today's session with its next block's detail", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay({ buddy: true, reviewDone: true });

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "learn", sessionId: session.id },
    });

    expect(isJsonObject(block.payload)).toBe(true);

    await prisma.studySessionBlock.update({
      data: {
        payload: {
          ...(isJsonObject(block.payload) ? block.payload : {}),
          title: "Percentages and discounts",
        },
      },
      where: { id: block.id },
    });

    const page = await openAs(browser, user);

    try {
      await page.goto("/today");
      // Continue lands above the highlighted row: it waits for the learner.
      const palette = await openLearnerPalette(page);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("percent");

      const next = palette
        .getByRole("group", { name: "Actions" })
        .getByRole("option", { name: /^Continue today's session/u });

      await expect(next).toContainText("Percentages and discounts");

      await expect(palette.getByRole("combobox", { name: /Search/iu })).toHaveAttribute(
        "aria-activedescendant",
        (await next.getAttribute("id"))!,
      );
    } finally {
      await page.context().close();
    }
  });

  test("mock finds completed results as well as the next mock action", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.goto("/today");
      // The mock exam action lands above the highlighted row: it waits for the learner.
      const palette = await openLearnerPalette(page);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("mock");
      await expect(palette.getByRole("option", { name: /^Take a mock exam/u })).toBeVisible();

      const result = palette
        .getByRole("group", { name: "Mock exams" })
        .getByRole("option", { name: /^Mock exam 1/u });

      await expect(result).toHaveAttribute("href", /^\/mock\//u);
      await result.click();
      await expect(page).toHaveURL(/\/mock\//u);
      await expect(palette).toBeHidden();
    });
  });

  test("catalog title matches precede descriptions and short queries avoid description noise", async ({
    page,
  }) => {
    const organization = await getAiOrganization();
    const query = `palette${randomUUID().slice(0, 8)}`;
    const title = `${query} title match`;
    const descriptionTitle = `Description match ${randomUUID()}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    await libraryChapterFixture({
      description: query,
      homeCourseId: course.id,
      title: descriptionTitle,
    });

    const short = randomUUID().replaceAll("-", "").slice(0, 4);
    const shortTitle = `${short} title only`;

    const [chapter] = await Promise.all([
      libraryChapterFixture({ description: short, homeCourseId: course.id }),
      courseFixture({
        isPublished: true,
        normalizedTitle: normalizeString(shortTitle),
        organizationId: organization.id,
        title: shortTitle,
      }),
    ]);

    await page.goto("/courses");
    const palette = await openPaletteWithKeyboard(page);
    const input = palette.getByRole("combobox", { name: /Search/iu });
    await input.fill(query);
    const results = palette.getByRole("group", { name: "In the catalog" }).getByRole("option");
    await expect(results).toHaveCount(2);
    await expect(results.first()).toContainText(title);
    await expect(results.last()).toContainText(descriptionTitle);
    await input.fill(short);

    await expect(
      palette.getByRole("option", { name: new RegExp(`^${shortTitle}`, "u") }),
    ).toBeVisible();

    await expect(palette.getByRole("option", { name: new RegExp(chapter.title, "u") })).toHaveCount(
      0,
    );
  });
});
