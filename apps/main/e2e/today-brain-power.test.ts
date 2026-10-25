import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs, saveMissions } from "./study-day";

// No progress row reads as 0 Brain Power, as a row at 0 does; a large total is grouped.
// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const progress of [null, 15_000]) {
  test(`Today keeps its reward total with ${progress === null ? "no progress row" : `${progress} Brain Power`}`, async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();

    await saveMissions(session.id, [
      { anchor: {}, kind: "askBuddy", opens: { kind: "buddy" }, total: 1 },
    ]);

    await prisma.userProgress.deleteMany({ where: { userId: user.id } });

    if (progress !== null) {
      await prisma.userProgress.create({
        data: { totalBrainPower: BigInt(progress), userId: user.id },
      });
    }

    const page = await openAs(browser, user);
    await page.goto("/today");
    await page.getByRole("button", { name: /^\+\d+ Brain Power$/u }).click();

    const total = new Intl.NumberFormat("en").format(progress ?? 0);
    const reward = page.getByRole("dialog", { exact: true, name: "Brain Power" });
    await expect(reward.getByText(/You have/u)).toHaveText(`You have ${total}`);

    const response = await page.request.get("/api/learner/views/today");
    await expect(response).toBeOK();

    await expect(response.json()).resolves.toMatchObject({
      copy: { view: { brainPower: progress ?? 0 } },
      status: "ready",
    });

    await page.context().close();
  });
}
