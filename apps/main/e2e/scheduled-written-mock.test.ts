import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";
import { addWrittenExamPrompts, createWrittenExamDay } from "./written-exam-fixtures";

const WRITTEN_TEST_MINUTES = 210;

test("Today waits for a scheduled written test and lets the learner open it once ready", async ({
  browser,
}) => {
  const day = await createWrittenExamDay({ plus: true, prompts: false });

  await prisma.studySessionBlock.update({
    data: {
      estimatedMinutes: WRITTEN_TEST_MINUTES,
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "weekly",
          mock: true,
          mockIdentity: { day: null, fullLength: false },
          passMark: 0,
          phase: null,
          timeLimitMinutes: WRITTEN_TEST_MINUTES,
          written: true,
        },
      },
    },
    where: { id: day.blockId },
  });

  const page = await openAs(browser, day.user);
  await page.goto("/today");

  const row = page.getByRole("listitem").filter({ hasText: "Mock exam" });
  const start = page.getByRole("button", { exact: true, name: "Start" });
  await expect(row.getByText("Getting ready…", { exact: true })).toBeVisible();
  await expect(start).toBeHidden();
  await expect(prisma.mockExam.count({ where: { userId: day.user.id } })).resolves.toBe(0);

  await addWrittenExamPrompts(day);
  await page.reload();
  await expect(row.getByText("Getting ready…", { exact: true })).toBeHidden();
  await start.click();
  await expect(page).not.toHaveURL(/\/today$/u);

  await expect(
    start.or(page.getByRole("timer", { name: "Time left" })),
    `Opening the written test from Today landed on ${page.url()}`,
  ).toBeVisible();
});
