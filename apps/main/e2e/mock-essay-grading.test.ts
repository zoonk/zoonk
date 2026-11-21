import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { continueToStep } from "./result-steps";
import { openAs } from "./study-day";

const ESSAY_TEXT =
  "O controle externo da administração pública cabe ao Congresso Nacional, com o auxílio do Tribunal de Contas da União, que julga as contas dos administradores e fiscaliza a aplicação dos recursos federais.";

const OFFLINE_EDIT = `${ESSAY_TEXT} A fiscalização também inclui auditorias.`;
const OTHER_DEVICE_EDIT = `${ESSAY_TEXT} O Congresso exerce o controle externo.`;

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

  // A written test admits its grading when it starts, so the sitting carries that receipt.
  const admission = await prisma.writingAdmission.create({
    data: {
      extra: false,
      id: randomUUID(),
      itemIds: [essay.id],
      localDate: new Date(startedAt.toISOString().slice(0, 10)),
      userId: user.id,
    },
  });

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
        writingAdmissionId: admission.id,
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
  test("a written answer survives a failed save and a stale edit stops the first hand-in", async ({
    browser,
  }) => {
    const { mock, user } = await writtenSitting({ expired: false });
    const page = await openAs(browser, user);
    const where = { mockExamId: mock.id };
    const url = `/mock/${mock.id}`;
    let offline = true;

    try {
      await page.route("**/*", async (route) => {
        const request = route.request();

        if (
          offline &&
          request.method() === "POST" &&
          request.headers()["next-action"] &&
          (request.postData() ?? "").includes('"itemId"')
        ) {
          await route.abort();
          return;
        }

        await route.fallback();
      });

      await page.goto(url);
      const answer = page.getByRole("textbox");
      await expect(answer).toHaveValue(ESSAY_TEXT);
      await answer.fill(OFFLINE_EDIT);
      await page.reload();
      await expect(answer).toHaveValue(OFFLINE_EDIT);

      await expect(prisma.mockExamAnswer.findFirstOrThrow({ where })).resolves.toMatchObject({
        answer: { text: ESSAY_TEXT },
      });

      offline = false;

      await expect
        .poll(() => prisma.mockExamAnswer.findFirstOrThrow({ where }))
        .toMatchObject({ answer: { text: OFFLINE_EDIT } });

      // Hold the next edit until the hand-in flushes it.
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      await answer.fill(ESSAY_TEXT);

      const other = await openAs(browser, user);

      try {
        await other.goto(url);
        await other.getByRole("textbox").fill(OTHER_DEVICE_EDIT);

        await expect
          .poll(() => prisma.mockExamAnswer.findFirstOrThrow({ where }))
          .toMatchObject({ answer: { text: OTHER_DEVICE_EDIT } });
      } finally {
        await other.context().close();
      }

      await page.getByRole("button", { exact: true, name: "Hand in" }).first().click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
      await expect(page.getByText("An answer wasn't saved.")).toBeVisible();

      await expect(prisma.mockExam.findUnique({ where: { id: mock.id } })).resolves.toMatchObject({
        status: "active",
      });

      await expect(prisma.mockExamAnswer.findFirstOrThrow({ where })).resolves.toMatchObject({
        answer: { text: OTHER_DEVICE_EDIT },
      });
    } finally {
      await page.context().close();
    }
  });

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

      // Here a two-argument action is finish or essay grading; the automatic section submit has three.
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
      await page.getByRole("button", { name: "See result" }).click();

      await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1/u })).toBeVisible();

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
