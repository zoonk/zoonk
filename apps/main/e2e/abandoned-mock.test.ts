import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { answerMockQuestions, createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const DAY_MS = 86_400_000;

async function storedTextAnswer({ itemId, mockExamId }: { itemId: string; mockExamId: string }) {
  const draft = await prisma.mockExamAnswer.findUnique({
    where: { mockItem: { itemId, mockExamId } },
  });

  return draft?.answer;
}

test.describe("A mock left running while the learner was away", () => {
  test("says its time ran out, isn't scored or counted, and a new one starts afresh", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);

    await page.goto("/mock/new");

    await page
      .getByRole("radiogroup", { name: "One subject" })
      .getByText("Mathematics", { exact: true })
      .click();

    await page.keyboard.press("Enter");

    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    const url = page.url();

    await answerMockQuestions({ answers, count: 1, knows: () => true, page });

    await expect
      .poll(() => prisma.mockExamAnswer.count({ where: { mockExam: { userId: user.id } } }))
      .toBe(1);

    // She leaves it for three days: the mock started then, and its clock ran out then.
    await prisma.mockExam.updateMany({
      data: { sectionStartedAt: new Date(Date.now() - 3 * DAY_MS) },
      where: { userId: user.id },
    });

    await page.goto(url);

    await expect(
      page.getByRole("heading", { level: 1, name: "Time ran out while you were away" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "With most of it unanswered, it isn't scored and doesn't change your preparation.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("timer")).toBeHidden();
    await expectAccessibleScreen(page, "a mock whose time ran out while the learner was away");

    // Nothing of it reached her record.
    await expect(
      Promise.all([
        prisma.attempt.count({ where: { userId: user.id } }),
        prisma.learningEvent.count({ where: { kind: "mock", userId: user.id } }),
      ]),
    ).resolves.toStrictEqual([0, 0]);

    // The exam's page offers a new mock and lists none taken.
    await page.goto("/exam");
    await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Continue your mock exam/u })).toBeHidden();
    await expect(page.getByRole("link", { name: /^Mock exam 1/u })).toBeHidden();

    // From the mock, a new one is picked as any other.
    await page.goto(url);
    await page.getByRole("link", { name: "Take a new mock exam" }).click();
    await expect(page).toHaveURL(/\/mock\/new$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Take a mock exam" })).toBeVisible();
  });

  for (const format of ["typed", "essay"] as const) {
    test(`a cleared ${format} draft stays blank on the sheet and expires without a score`, async ({
      browser,
    }) => {
      const { goal, user } = await createAnytimeMockLearner({
        formats: true,
        plus: true,
        written: true,
      });

      const [text, objective] = await Promise.all([
        prisma.item.findFirstOrThrow({ where: { examBlueprintId: goal.examBlueprintId, format } }),
        prisma.item.findFirstOrThrow({
          where: { examBlueprintId: goal.examBlueprintId, format: "multipleChoice" },
        }),
      ]);

      const mock = await prisma.mockExam.create({
        data: {
          conditions: {
            day: null,
            fullLength: true,
            purpose: "practice",
            scoring: "raw",
            sections: [
              {
                essays: format === "essay" ? [text.id] : [],
                itemIds: format === "typed" ? [text.id, objective.id] : [objective.id],
                minutes: 30,
                name: "Written answers",
                questions: format === "typed" ? 2 : 1,
                routing: null,
              },
            ],
            startTime: null,
            timeZone: null,
          },
          examBlueprintId: goal.examBlueprintId,
          goalId: goal.id,
          sectionStartedAt: new Date(),
          userId: user.id,
        },
      });

      const page = await openAs(browser, user);
      await page.goto(`/mock/${mock.id}`);
      const sheet = page.getByRole("complementary", { name: "Answer sheet" });

      if (format === "essay") {
        await sheet.getByRole("button", { exact: true, name: "Written part" }).click();
      }

      const answer = page.getByRole("textbox", { exact: true, name: "Your answer" });
      await answer.fill("I started an answer and changed my mind.");
      await expect(sheet.getByText("1 answered · 0 flagged", { exact: true })).toBeVisible();

      await expect
        .poll(() => storedTextAnswer({ itemId: text.id, mockExamId: mock.id }))
        .toEqual({ text: "I started an answer and changed my mind." });

      const cleared = format === "essay" ? "   " : "";
      await answer.fill(cleared);
      await expect(sheet.getByText("0 answered · 0 flagged", { exact: true })).toBeVisible();

      await expect
        .poll(() => storedTextAnswer({ itemId: text.id, mockExamId: mock.id }))
        .toEqual({ text: cleared });

      await prisma.mockExam.update({
        data: { sectionStartedAt: new Date(Date.now() - 3 * DAY_MS) },
        where: { id: mock.id },
      });

      await page.goto(`/mock/${mock.id}`);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("timer")).toBeHidden();

      await expect(page.getByRole("link").filter({ hasNotText: /^Leave$/u })).toHaveAttribute(
        "href",
        "/mock/new",
      );

      await expect(prisma.attempt.count({ where: { mockExamId: mock.id } })).resolves.toBe(0);

      await expect(
        prisma.learningEvent.count({ where: { kind: "mock", userId: user.id } }),
      ).resolves.toBe(0);

      await page.goto(`/pt/mock/${mock.id}`);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      await expect(page.getByRole("link").filter({ hasNotText: /^Sair$/u })).toHaveAttribute(
        "href",
        "/pt/mock/new",
      );

      await page.context().close();
    });
  }
});
