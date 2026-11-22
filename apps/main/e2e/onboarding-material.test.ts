import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { stopRuns } from "./generation-run";

const DRAFT_URL = /\/start\?draft=[0-9a-f-]{36}$/u;

function cellCycleCard({ draftId, prompt }: { draftId: string; prompt: string }) {
  return {
    goals: [
      {
        draft: {
          details: { onboardingId: draftId, subject: "the cell cycle" },
          displayName: "Cell cycle",
          kind: "exam",
          language: "en",
          prompt,
          title: "Pass the cell cycle test",
        },
        examDates: [],
      },
    ],
    schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
    status: "goals",
  };
}

const NOTES = "Interphase: G1, S and G2.\n\nMitosis: prophase, metaphase, anaphase, telophase.";

test.describe("A goal sent with the learner's material", () => {
  test("asks to add again material it can't read anymore, keeps it on its card through a reload, and creates the goal with it", async ({
    noProgressUser: user,
    userWithoutProgress: page,
  }) => {
    const words = `test on Friday ${randomUUID().slice(0, 8)}`;
    const resumeReads = await stopRuns({ page });

    await page.goto("/start");
    const attach = page.getByRole("button", { name: "Study your own material" });
    const goalBox = page.getByRole("textbox", { name: "I want to" });

    const addNotes = async () => {
      await attach.click();
      await page.getByRole("button", { name: "Paste text" }).click();
      await page.getByRole("textbox", { name: "Your text" }).fill(NOTES);
      await page.getByRole("button", { name: "Add text" }).click();
    };

    await expectHydrated(attach);
    await addNotes();
    await page.getByRole("radio", { name: /^Prepare for an exam/u }).click();
    await goalBox.fill(words);

    await prisma.learnerSource.deleteMany({ where: { origin: "upload", userId: user.id } });
    await page.getByRole("button", { name: "Build my plan" }).click();

    const removeNotes = page.getByRole("button", { name: "Remove Your text" });

    await expect(removeNotes).toHaveAccessibleDescription(
      "We can't read “Your text” anymore. Remove it and add it again.",
    );

    await expect(goalBox).toHaveValue(words);
    await removeNotes.click();
    await addNotes();
    await expect(removeNotes).toHaveAccessibleDescription("");
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(DRAFT_URL);

    const [draft, upload] = await Promise.all([
      prisma.onboardingDraft.findFirstOrThrow({ where: { prompt: words } }),
      prisma.learnerSource.findFirstOrThrow({ where: { origin: "upload", userId: user.id } }),
    ]);

    expect(draft).toMatchObject({ materialIntent: "exam", sourceIds: [upload.sourceId] });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await resumeReads();

    await prisma.onboardingDraft.update({
      data: {
        status: "understood",
        understanding: cellCycleCard({ draftId: draft.id, prompt: words }),
      },
      where: { id: draft.id },
    });

    await page.getByRole("button", { name: "Try again" }).click();

    const material = page.getByText("Your material", { exact: true });

    await expect(page.getByText("Cell cycle", { exact: true })).toBeVisible();
    await expect(material).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Here's what we understood" })).toBeVisible();
    await expect(material).toBeVisible();

    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    const goal = await prisma.goal.findFirstOrThrow({
      select: { details: true, id: true },
      where: { onboardingDraftId: draft.id },
    });

    expect(goal.details).toMatchObject({ materialIntent: "exam" });

    await expect(
      prisma.goalSource.findUnique({
        where: { goalId_sourceId: { goalId: goal.id, sourceId: upload.sourceId } },
      }),
    ).resolves.toMatchObject({ origin: "upload" });
  });
});
