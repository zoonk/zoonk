import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { createMistakeLearner } from "./mistake-drill-days";
import { LESSON_TITLE, createStudyDay, openAs } from "./study-day";

const LAPTOP = { height: 900, width: 1440 };
const PHONE = { height: 844, width: 390 };

test.describe("Today's missions card", () => {
  test("shows missions on the first Today load and one page heading across Today and Plan", async ({
    browser,
  }) => {
    const { user } = await createMistakeLearner({ causes: ["trap"] });
    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's missions" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.getByRole("link", { exact: true, name: "Plan" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.context().close();
  });

  test("says what each mission still asks and how long, marks the block it opens, and explains the reward", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.setViewportSize(LAPTOP);
    await page.goto("/today");

    // The buddy offers the day's missions with their reward and about how long they take.
    const missions = page.getByRole("region", { name: "Today's missions" });
    await expect(missions).toContainText(/2 missions\s·\s~5\smin/u);

    await expect(missions.getByRole("listitem")).toHaveText([
      /^Review, go to today's review\s*Quick review\s·\s2\smin$/u,
      new RegExp(
        `^Do a new lesson, go to today's new lesson\\s*${LESSON_TITLE}\\s·\\s3\\smin$`,
        "u",
      ),
    ]);

    // The day's queue marks the blocks the missions open, and only those.
    const queue = page.getByRole("region", { name: "Today's session" });

    await expect(
      queue.getByRole("button", { exact: true, name: "Quick review, counts toward a mission" }),
    ).toBeVisible();

    await expect(
      queue.getByRole("button", { exact: true, name: `${LESSON_TITLE}, counts toward a mission` }),
    ).toBeVisible();

    await expect(queue.getByText(", counts toward a mission", { exact: true })).toHaveCount(0);

    // A tap on the reward says what Brain Power is and how much the learner has.
    await missions.getByRole("button", { name: "+50 Brain Power" }).click();
    const explainer = page.getByRole("dialog", { name: "Brain Power" });
    await expect(explainer).toContainText("What you've learned, in points");
    await expect(explainer).toContainText(/You have \d+/u);
    await page.keyboard.press("Escape");

    // Done elsewhere (another device), the review's mark goes and the card counts it.
    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { kind: "review", sessionId: session.id },
    });

    await page.reload();
    await expect(missions).toContainText(/1 left\s·\s~3\smin/u);
    await expect(page.locator("[data-slot=mission-row-mark]")).toHaveCount(1);
    await page.context().close();
  });

  test("folds to one line with the reward lit once every mission is done, and the buddy's day keeps the list", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay({ buddy: true });

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { kind: { in: ["review", "learn"] }, sessionId: session.id },
    });

    await prisma.studySession.update({
      data: { fullMealAt: new Date() },
      where: { id: session.id },
    });

    const page = await openAs(browser, user);
    await page.setViewportSize(LAPTOP);
    await page.goto("/today");

    const done = page.locator("[data-slot=missions-card]");
    await expect(done).toHaveText(/^Missions done.*\+50\s*Brain Power$/u);
    await expect(done.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();
    await expect(page.locator("[data-slot=mission-row-mark]")).toHaveCount(0);

    await page.goto("/buddy");
    const day = page.getByRole("region", { name: "Missions done" });
    await expect(day).toContainText("You earned +50 Brain Power.");
    await expect(day.getByRole("listitem")).toHaveText(["Review, done", "Do a new lesson, done"]);
    await page.context().close();
  });

  test("says in one quiet line when another goal already earned today's bonus, with nothing marked", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();

    await prisma.studySession.update({
      data: { fullMealAt: new Date() },
      where: { id: session.id },
    });

    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    await page.goto("/today");

    await expect(page.locator("[data-slot=missions-card]")).toHaveText(
      "Today's +50 Brain Power is already earned.",
    );

    await expect(page.locator("[data-slot=mission-row-mark]")).toHaveCount(0);
    await page.context().close();
  });

  // Ana's phone listed her two blocks twice: in the day's queue, then as the missions' rows.
  test("on a phone, missions that only open the day's blocks show once, their card's header after the day's action", async ({
    browser,
  }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    await page.goto("/today");

    const missions = page.getByRole("region", { name: "Today's missions" });

    await expect(missions).toBeInViewport();
    await expect(page.getByText(/^Missions · /u)).toHaveCount(0);
    await expect(missions).toContainText(/2 missions\s·\s~5\smin/u);
    await expect(missions.getByRole("listitem")).toHaveCount(0);

    // The queue lists those blocks, marked as counting toward a mission.
    await expect(
      page
        .getByRole("region", { name: "Today's session" })
        .getByRole("button", { exact: true, name: "Quick review, counts toward a mission" }),
    ).toBeVisible();

    await missions.screenshot({ path: test.info().outputPath("today-missions-phone.png") });

    // Beside the queue, the card keeps its rows: each named in one run, without a space before the
    // comma, and described by its line.
    await page.setViewportSize(LAPTOP);
    await expect(missions.getByRole("listitem")).toHaveCount(2);

    await expect(
      missions.getByRole("button", { name: "Review, go to today's review" }),
    ).toHaveAccessibleDescription(/^Quick review\s·\s2\smin$/u);

    await page.context().close();
  });
});
