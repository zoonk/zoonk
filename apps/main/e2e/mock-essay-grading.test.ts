import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { settleAnimations } from "@zoonk/testing/accessibility/scan";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

const ESSAY_TEXT =
  "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

/** A resumed last section whose essay is already saved; no generation is needed to reach it. */
async function writtenSitting({
  expired,
  questionClock = false,
}: {
  expired: boolean;
  questionClock?: boolean;
}) {
  const { goal, user } = await createAnytimeMockLearner({ plus: true, written: true });

  const [objective, essay] = await Promise.all([
    prisma.item.findFirstOrThrow({
      where: { examBlueprintId: goal.examBlueprintId, format: "multipleChoice" },
    }),
    prisma.item.findFirstOrThrow({
      where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
    }),
  ]);

  const startedAt = new Date(Date.now() - (expired ? 120_000 : 0));

  const mock = await prisma.mockExam.create({
    data: {
      answers: {
        create: {
          answer: { text: ESSAY_TEXT },
          durationMs: questionClock ? 0 : 60_000,
          itemId: essay.id,
        },
      },
      conditions: {
        day: null,
        fullLength: true,
        purpose: "practice",
        scoring: "raw",
        sections: [
          {
            essays: [],
            itemIds: [objective.id],
            minutes: 1,
            name: "Objective test",
            questions: 1,
            routing: null,
          },
          {
            essays: [essay.id],
            itemIds: [],
            minutes: 1,
            name: "Written test",
            navigation: {
              answerChanges: null,
              forwardOnly: false,
              itemSeconds: questionClock ? 1 : null,
              mustAnswer: false,
            },
            questions: 0,
            routing: null,
          },
        ],
        shape: { area: null, day: null, kind: "full" },
        startTime: null,
        timeZone: null,
      },
      goalId: goal.id,
      sectionIndex: 1,
      sectionStartedAt: startedAt,
      startedAt,
      userId: user.id,
    },
  });

  return { mock, user };
}

test.describe("Mock essays need a learner's grading request", () => {
  for (const mode of ["expired", "section", "question"] as const) {
    test(`${mode} timeout closes answers without requesting AI grading`, async ({
      browser,
    }, testInfo) => {
      const expired = mode === "expired";
      const { mock, user } = await writtenSitting({ expired, questionClock: mode === "question" });
      const page = await openAs(browser, user);
      const gradingRequests: string[] = [];
      const sectionRequests: string[] = [];

      if (!expired) {
        await page.clock.install();
      }

      // On this route, a two-argument action is finish or essay grading. The automatic section
      // submit has three arguments. Block grading before the server sees it, so RED never runs AI.
      await page.route("**/*", async (route) => {
        const request = route.request();
        const body = request.postData() ?? "";

        if (
          request.method() === "POST" &&
          request.headers()["next-action"] &&
          /^\["[\w-]+",\d+,"[^"\]]+"\]$/u.test(body)
        ) {
          sectionRequests.push(body);
        }

        if (
          request.method() === "POST" &&
          request.headers()["next-action"] &&
          /^\["[\w-]+","[^"\]]+"\]$/u.test(body)
        ) {
          gradingRequests.push(body);
          await route.abort();
          return;
        }

        await route.fallback();
      });

      await page.goto(`/mock/${mock.id}`);

      if (!expired) {
        await expect(page.getByRole("timer", { exact: true, name: "Time left" })).toBeVisible();

        if (mode === "section") {
          await prisma.mockExam.update({
            data: { sectionStartedAt: new Date(Date.now() - 120_000) },
            where: { id: mock.id },
          });
        }

        await page.clock.fastForward(mode === "question" ? 1000 : 120_000);
      }

      await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
      await expect(page.getByLabel("Your answer")).toBeHidden();

      if (mode === "question") {
        await expect
          .poll(async () => {
            const answer = await prisma.mockExamAnswer.findFirstOrThrow({
              where: { mockExamId: mock.id },
            });

            return answer.durationMs;
          })
          .toBeGreaterThanOrEqual(1000);

        await page.reload();
        await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
        await expect(page.getByLabel("Your answer")).toBeHidden();
      }

      await expect(
        prisma.mockExamAnswer.findFirstOrThrow({ where: { mockExamId: mock.id } }),
      ).resolves.toMatchObject({ answer: { text: ESSAY_TEXT } });

      if (mode === "expired") {
        await expectAccessibleScreen(page, "a mock's time-up screen");

        for (const width of [390, 820, 1180, 1440]) {
          for (const colorScheme of ["light", "dark"] as const) {
            // oxlint-disable-next-line no-await-in-loop -- Each responsive state is viewed in order.
            await page.setViewportSize({ height: 900, width });
            // oxlint-disable-next-line no-await-in-loop -- A theme belongs to the screen being viewed.
            await page.emulateMedia({ colorScheme });
            // oxlint-disable-next-line no-await-in-loop -- Theme transitions finish before their screenshot.
            await page.evaluate(settleAnimations, 3000);
            // oxlint-disable-next-line no-await-in-loop -- The next action stays available at every size.
            await expect(page.getByRole("button", { name: "See how it went" })).toBeVisible();
            // oxlint-disable-next-line no-await-in-loop -- Each screenshot records its own width and theme.
            await page.screenshot({
              path: testInfo.outputPath(`time-up-${width}-${colorScheme}.png`),
            });
          }
        }
      }

      if (mode === "expired") {
        await page.goto(`/pt/mock/${mock.id}`);
        await expect(page.getByRole("heading", { name: "O tempo acabou" })).toBeVisible();

        for (const width of [390, 820, 1180, 1440]) {
          for (const colorScheme of ["light", "dark"] as const) {
            // oxlint-disable-next-line no-await-in-loop -- Each translated responsive state is viewed in order.
            await page.setViewportSize({ height: 900, width });
            // oxlint-disable-next-line no-await-in-loop -- A theme belongs to the screen being viewed.
            await page.emulateMedia({ colorScheme });
            // oxlint-disable-next-line no-await-in-loop -- Wait for real theme transitions before recording the view.
            await page.evaluate(settleAnimations, 3000);
            // oxlint-disable-next-line no-await-in-loop -- The translated next action stays visible.
            await expect(page.getByRole("button", { name: "Ver como foi" })).toBeVisible();
            // oxlint-disable-next-line no-await-in-loop -- Each screenshot records its own locale, width and theme.
            await page.screenshot({
              path: testInfo.outputPath(`time-up-pt-${width}-${colorScheme}.png`),
            });
          }
        }

        await page.goto(`/en/mock/${mock.id}`);
        await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
      }

      await expect(prisma.mockExam.findUnique({ where: { id: mock.id } })).resolves.toMatchObject({
        status: "active",
      });

      await expect(prisma.attempt.count({ where: { mockExamId: mock.id } })).resolves.toBe(0);
      expect(gradingRequests).toHaveLength(0);
      expect(sectionRequests).toHaveLength(0);
      await page.getByRole("button", { name: "See how it went" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u }),
      ).toBeVisible();

      await expect
        .poll(() => prisma.mockExam.findUnique({ where: { id: mock.id } }))
        .toMatchObject({ status: "finished" });

      await continueToStep(page, "Your answer");
      await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
      expect(gradingRequests).toHaveLength(1);
      expect(sectionRequests).toHaveLength(1);
      await expect(prisma.attempt.count({ where: { mockExamId: mock.id } })).resolves.toBe(1);

      await page.getByRole("button", { name: "Grade it" }).click();
      await expect(page.getByText("That didn't go through. Try again in a moment.")).toBeVisible();
      await expect.poll(() => gradingRequests.length).toBe(2);
      await page.context().close();
    });
  }
});
