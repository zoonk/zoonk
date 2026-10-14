import { prisma } from "@zoonk/db";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { isJsonObject } from "@zoonk/utils/json";
import { createCheckpointLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

test("Continue on a started challenge resumes its clock, and a stale intro still opens a finished result", async ({
  browser,
}) => {
  const { block, boss, user } = await createCheckpointLearner();
  const startedAt = new Date(Date.now() - 60_000);

  await prisma.studySessionBlock.update({
    data: {
      payload: {
        ...(isJsonObject(block.payload) ? block.payload : {}),
        timing: { activeAt: null, elapsedMs: 60_000 },
      },
      startedAt,
      status: "active",
    },
    where: { id: block.id },
  });

  const other = await studySessionBlockFixture({
    estimatedMinutes: 5,
    kind: "practice",
    payload: { timing: { activeAt: startedAt.toISOString(), elapsedMs: 0 } },
    position: block.position + 1,
    sessionId: block.sessionId,
    startedAt,
    status: "active",
  });

  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

  await expect
    .poll(async () => {
      const current = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } });
      const timing = isJsonObject(current.payload) ? current.payload.timing : null;
      return isJsonObject(timing) ? timing.activeAt : "missing";
    })
    .toBeNull();

  const resumed = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
  const timing = isJsonObject(resumed.payload) ? resumed.payload.timing : null;
  expect(isJsonObject(timing) && typeof timing.activeAt === "string").toBe(true);
  await page.goto(`/challenge/${boss.id}`);
  await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeVisible();

  await prisma.studySessionBlock.update({
    data: { completedAt: new Date(), status: "completed" },
    where: { id: block.id },
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
  await expect(page.getByText("That didn't go through. Try again in a moment.")).toHaveCount(0);

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "completed" });

  await page.context().close();
});
