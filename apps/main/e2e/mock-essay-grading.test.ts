import { prisma } from "@zoonk/db";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

const ESSAY_TEXT =
  "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

/** A resumed last section whose essay is already saved; no generation is needed to reach it. */
async function writtenSitting({ expired }: { expired: boolean }) {
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
      answers: { create: { answer: { text: ESSAY_TEXT }, durationMs: 60_000, itemId: essay.id } },
      conditions: {
        day: null,
        examQuestions: null,
        fullLength: true,
        partialCredit: "allOrNothing",
        purpose: "practice",
        reused: 0,
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
              itemSeconds: null,
              mustAnswer: false,
            },
            questions: 0,
            routing: null,
          },
        ],
        shape: { area: null, day: null, kind: "full" },
        startTime: null,
        timeZone: null,
        timedOutSections: [],
        wrongPenalty: 1,
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
  for (const mode of ["expired", "section"] as const) {
    test(`${mode} timeout closes answers without requesting AI grading`, async ({ browser }) => {
      const expired = mode === "expired";
      const { mock, user } = await writtenSitting({ expired });
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

        await prisma.mockExam.update({
          data: { sectionStartedAt: new Date(Date.now() - 120_000) },
          where: { id: mock.id },
        });

        await page.clock.fastForward(120_000);
      }

      await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
      await expect(page.getByLabel("Your answer")).toBeHidden();

      await expect(
        prisma.mockExamAnswer.findFirstOrThrow({ where: { mockExamId: mock.id } }),
      ).resolves.toMatchObject({ answer: { text: ESSAY_TEXT } });

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
