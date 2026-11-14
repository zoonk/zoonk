import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated, holdScripts } from "@zoonk/e2e/hydration";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

test.describe("Text typed before the page hydrates", () => {
  test("a guest's help message sent before the page hydrates goes out with the email typed", async ({
    page,
  }) => {
    const email = `early-${randomUUID()}@zoonk.test`;
    const message = `The lesson froze on my phone ${randomUUID()}`;
    const release = await holdScripts(page);

    await page.goto("/support", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Message" }).fill(message);
    await page.getByRole("textbox", { name: "Your email, for our reply" }).fill(email);
    await page.getByRole("button", { name: "Send message" }).click();
    await release();

    await expect(
      page.getByText("Message sent successfully! We'll get back to you soon."),
    ).toBeVisible();

    await expect.poll(() => prisma.feedback.count({ where: { email, message } })).toBe(1);
  });

  test("a name typed before the page hydrates stays after its save and the next one", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const typedName = `Early ${randomUUID().slice(0, 8)}`;
    const newUsername = `early_${randomUUID().slice(0, 8)}`;
    const release = await holdScripts(page);

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    const name = page.getByRole("textbox", { exact: true, name: "Name" });
    await name.fill(typedName);
    await release();
    await expectHydrated(name);

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(name).toHaveValue(typedName);

    await page.getByRole("textbox", { name: "Username" }).fill(newUsername);
    await expect(page.getByText(`${newUsername} is available`)).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(() =>
        prisma.user.findUniqueOrThrow({
          select: { name: true, username: true },
          where: { id: noProgressUser.id },
        }),
      )
      .toEqual({ name: typedName, username: newUsername });
  });

  test("an answer typed before a lesson hydrates is the one checked", async ({
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["typedAnswer"] });
    const release = await holdScripts(page);

    await page.goto(`/learn/${lesson.id}`, { waitUntil: "domcontentloaded" });

    const answer = page.getByRole("textbox", {
      name: "In your own words: why is the electron drawn as a cloud?",
    });

    await answer.fill("It shows where the electron is likely to be");
    await release();
    await expectHydrated(answer);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  });

  test("words added before hydration to a goal the link filled in stay in the box", async ({
    page,
  }) => {
    const release = await holdScripts(page);

    await page.goto("/start?goal=learn+to+cook", { waitUntil: "domcontentloaded" });
    const box = page.getByRole("textbox", { name: "I want to" });
    await expect(box).toHaveValue("learn to cook");
    await box.fill("learn to cook for my family");
    await release();
    await expectHydrated(box);

    await expect(box).toHaveValue("learn to cook for my family");
  });

  test("a time a day picked before the step hydrates is the one saved", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);
    const answered = [...ANSWERED.filter((step) => step !== "schedule"), "placement"];

    await prisma.goal.update({
      data: { details: { answered, subject: "algebra" } },
      where: { id: goal.id },
    });

    const release = await holdScripts(page);
    await page.goto(`/start/${goal.id}`, { waitUntil: "domcontentloaded" });

    const time = page.getByLabel("Time a day", { exact: true });
    await time.selectOption("45");
    await release();
    await expectHydrated(time);

    await expect(time).toHaveValue("45");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
    await expect(page.getByText("45 min", { exact: true })).toBeVisible();
  });
});
