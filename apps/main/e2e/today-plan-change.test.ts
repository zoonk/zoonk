import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/** What the plan-edit model said of the learner's words, stored with the change. */
const PROPOSAL = "Twenty-five minutes a day keeps your plan on track for the exam.";

/** What the card says instead: the change's own operation, never the model's summary of it. */
const PROPOSAL_CARD = "Daily time changed to 25 min.";
const DAYS_PER_WEEK = 7;
const STUDY_MINUTES = 30;
const LESSONS = 3;

/** A goal date this close, which no daily time covers. */
const SOON_DAYS = 5;

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

/**
 * A learner whose plan the planner owns (a skill graph and settings), with one chapter of three
 * lessons, so a test-out's skip and its undo re-plan around them.
 */
async function createChapterPlan() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const indexes = Array.from({ length: LESSONS }, (_, index) => index);

  const [goal, chapter, skills, lessons] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Circuits ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Electric circuits ${suffix}` }),
    Promise.all(indexes.map((index) => skillFixture({ name: `Circuit skill ${index} ${suffix}` }))),
    Promise.all(
      indexes.map((index) => libraryLessonFixture({ title: `Circuit lesson ${index} ${suffix}` })),
    ),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Circuits" }],
        skills: skills.map((skill) => ({
          area: null,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
      settings: {
        startDate: toUTCMidnight(new Date()).toISOString().slice(0, "YYYY-MM-DD".length),
        weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => STUDY_MINUTES),
      },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.lessonSkill.createMany({
      data: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? "",
      })),
    }),
  ]);

  const items = await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        titleSnapshot: lesson.title,
      }),
    ),
  );

  return { chapter, goal, items, plan, user };
}

/**
 * Today's notice is the one place to answer a plan change: any proposal waiting for an OK, and the
 * automatic changes of the last day, with their undo while the plan is still as they left it.
 */
/** An area's topics as a change names them: "Ethics topic 1", "Ethics topic 2"… */
function areaTopics(area: string, count: number) {
  return {
    area,
    topics: Array.from({ length: count }, (_, index) => `${area} topic ${index + 1}`),
  };
}

test.describe("Today's plan change", () => {
  test("applies a proposal from the plan's assistant right on Today, by keyboard", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.goto("/today");

      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(PROPOSAL_CARD);
      await expect(note).not.toContainText(PROPOSAL);

      // Nothing changes before the learner's OK.
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await tabTo(page, note.getByRole("button", { name: "Apply" }));
      await page.keyboard.press("Enter");

      // The answer says what it did, where the buttons were, and focus stays on the note: today's
      // session wasn't started, so it follows the change.
      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
      );

      await expect(note).toBeFocused();
      await expect(page).toHaveURL(/\/today$/u);

      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(25);
    });
  });

  test("answers each waiting proposal in turn, the buddy's and the exam notice's", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      // The persona's own waiting proposal is answered already, so only these two wait.
      await prisma.planChange.updateMany({
        data: { status: "declined" },
        where: { planId: plan.id, status: "proposed" },
      });

      // The notice's date came first; the buddy's time came later and changes something else.
      const notice = await planChangeFixture({
        createdAt: new Date(Date.now() - 60_000),
        kind: "edited",
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
          source: "notice",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      });

      const time = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.goto("/today");

      // The newest shows first, alone; the other waits without clutter.
      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(PROPOSAL_CARD);
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);

      await note.getByRole("button", { name: "Apply" }).click();
      await expect(note.getByRole("status")).toContainText("It's in your plan");
      await expect.poll(() => readChangeStatus(time.id)).toBe("applied");

      // Then the one still waiting, by keyboard: it takes the notice's place and focus.
      const next = note.getByRole("button", { name: "Next suggestion" });
      await tabTo(page, next);
      await page.keyboard.press("Enter");

      const noticeNote = page.getByRole("region", { name: "Suggested change" });
      await expect(noticeNote).toContainText(/^The exam notice says /u);
      await expect(noticeNote).toBeFocused();

      await noticeNote.getByRole("button", { name: "Keep mine" }).click();
      await expect(noticeNote.getByRole("status")).toHaveText("Your plan stays as it was.");
      await expect.poll(() => readChangeStatus(notice.id)).toBe("declined");
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);
    });
  });

  test("asks before the exam notice's day moves the plan, and Keep mine keeps the learner's date", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      const change = await planChangeFixture({
        kind: "edited",
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
          source: "notice",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      });

      await page.goto("/today");

      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(/^The exam notice says /u);
      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();

      await note.getByRole("button", { name: "Keep mine" }).click();
      await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");

      await expect.poll(() => readChangeStatus(change.id)).toBe("declined");

      const kept = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      expect(kept.targetDate).toStrictEqual(goal.targetDate);
    });
  });

  test("names what a suggested change leaves out and the end it moves", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Cell biology ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Osmosis in red cells ${suffix}` }),
    ]);

    // A plan the planner doesn't own, so no refresh replaces the proposal while Today opens.
    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Pedro's focus on osmosis: two lessons in, four of his plan's lessons out, one topic gone,
    // and genetics, which he didn't name, gets four more lessons.
    await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          areaEnds: [
            { after: "2099-12-04", area: "Osmosis", before: "2100-02-02" },
            { after: "2100-03-01", area: "Biology", before: "2100-01-10", lessonsGained: 12 },
          ],
          areaLessons: [{ after: 44, area: "Genetics", before: 40 }],
          areaStarts: [{ after: "2099-10-09", area: "Osmosis", before: "2099-10-09" }],
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 2,
          lessonsAddedEstimated: true,
          lessonsLeftOut: ["Chromatin", "Golgi apparatus", "Lysosomes", "Peroxisomes"],
          lessonsRemoved: 4,
          topicsLeftOut: [{ area: "Biology", topics: ["12 Viruses"] }],
        },
        operations: [{ areas: ["Biology"], kind: "focusAreas", parts: [] }],
        source: "planEdit",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Suggested change" });

    // Lessons are never called topics: Rafaela's card listed lesson titles "and 27 more topics".
    await expect(note).toContainText(
      "Adds about 2 lessons and leaves out 4: Chromatin, Golgi apparatus, Lysosomes and 1 more.",
    );

    // A topic goes by its words, without the notice's number for it.
    await expect(note).toContainText("1 topic leaves: Viruses.");
    await expect(note).not.toContainText("12 Viruses");

    // A start that stays says nothing next to the end the focus brings forward.
    await expect(note).toContainText(
      "You finish Osmosis around December 4, 2099 instead of February 2, 2100.",
    );

    await expect(note).not.toContainText("You still start");

    // An area that ends later because it gets more lessons says so, in the same sentence, as an
    // estimate while some of them aren't written: Ana read only that she'd finish Linguagens
    // two and a half months later, two weeks before her exam.
    await expect(note).toContainText(
      "Biology gets about 12 more lessons, so you finish it around March 1, 2100 instead of January 10, 2100.",
    );

    // An area the change doesn't name never moves without the card saying so.
    await expect(note).toContainText("Genetics: 44 lessons to go instead of 40.");
    await page.context().close();
  });

  test("counts every lesson a change leaves out when it names only some of them", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Enem ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Cultural identity ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Ana's earlier date: 44 lessons out, five of them by name (a topic's lessons not written yet
    // go by its name), so the names are a few examples, never "and 2 more" beside 44.
    await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsLeftOut: [
            "Situated identities",
            "Belonging",
            "Cultural exchange",
            "Digital genres",
            "Art and society",
          ],
          lessonsRemoved: 44,
        },
        operations: [{ kind: "setTargetDate", targetDate: "2099-11-07" }],
        source: "planEdit",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Suggested change" })).toContainText(
      "Leaves out 44 lessons, such as Situated identities, Belonging, and Cultural exchange.",
    );

    await page.context().close();
  });

  test("says about how many lessons a topic adds while they aren't written", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson, skill] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Investing ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `How a stock price moves ${suffix}` }),
      skillFixture({ name: `Investing small amounts ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Pedro's buddy added a topic the Library hadn't written: the card said 8 lessons, and the
    // Library wrote 5. Until they're written, the count is the plan's estimate.
    await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 8,
          lessonsAddedEstimated: true,
          lessonsRemoved: 0,
        },
        operations: [
          {
            kind: "addSkills",
            skills: [
              { area: null, beforeSkillId: null, lessons: 8, name: skill.name, skillId: skill.id },
            ],
          },
        ],
        source: "buddy",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Suggested change" })).toContainText(
      "Adds about 8 lessons.",
    );

    await page.context().close();
  });

  test("says the day a change moves the next mock to", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Enem ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Cultural identity ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // More time a day spaces the mocks closer: Ana's next one moved three weeks with no word.
    await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 0,
          nextMock: { after: "2099-11-01", before: "2099-11-22" },
        },
        operations: [{ kind: "setDailyMinutes", minutes: 180 }],
        source: "planEdit",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Suggested change" })).toContainText(
      "Your next mock moves to Sunday, November 1.",
    );

    await page.context().close();
  });

  test("says which topics no longer fit when the plan changes as the learner studies", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Enem ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Food chains ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Lucas's plan after his first lesson: planned again, one topic no longer fits by his date.
    await planChangeFixture({
      kind: "coverageChanged",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 4,
          topicsLeftOut: [{ area: "Natural sciences", topics: ["Origin and evolution of life"] }],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "Planned again, the plan teaches other topics by its date.",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note).toContainText("Origin and evolution of life no longer fits by your date.");
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();
    await page.context().close();
  });

  test("names the subjects, not every topic, when a mock brings many known topics back", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `OAB ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Legal fees ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Sofia's first full mock: misses on topics placement took as known, in six subjects.
    await planChangeFixture({
      kind: "relearn",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 108,
          lessonsRemoved: 0,
          topicsAdded: [
            areaTopics("Ethics", 5),
            areaTopics("Civil Law", 2),
            areaTopics("Labor Law", 2),
            areaTopics("Business Law", 2),
            areaTopics("Civil Procedure", 2),
            areaTopics("Labor Procedure", 2),
          ],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note).toContainText(
      "15 topics from Ethics, Civil Law, Labor Law, and 3 other subjects are back in your plan: you missed questions on them.",
    );

    await expect(note).not.toContainText("Ethics topic 1");
    await page.context().close();
  });

  // Missed days on a plan short on time leave topics out: the card names them, whether or not
  // the plan now covers less of the exam.
  for (const behind of [
    null,
    {
      canFocus: true,
      coveredAfter: 0.5,
      coveredBefore: 0.6,
      currentMinutes: 15,
      dailyMinutes: 30,
      fullDepth: true,
      measure: "exam",
    },
  ]) {
    test(`names the topics missed days leave out of the plan (${behind ? "behind" : "keeping pace"})`, async ({
      browser,
    }) => {
      const user = await createE2EUser(getBaseURL());
      const suffix = randomUUID().slice(0, 6);

      const [goal, lesson] = await Promise.all([
        goalFixture({ timezone: "UTC", title: `Enem ${suffix}`, userId: user.id }),
        libraryLessonFixture({ title: `Food chains ${suffix}` }),
      ]);

      const [plan] = await Promise.all([
        planFixture({ goalId: goal.id }),
        learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      ]);

      await planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position: 0,
        scheduledFor: toUTCMidnight(new Date()),
        titleSnapshot: lesson.title,
      });

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind,
          days: 4,
          effect: {
            endDateAfter: null,
            endDateBefore: null,
            lessonsAdded: 0,
            lessonsRemoved: 6,
            topicsLeftOut: [{ area: "Natural sciences", topics: ["Food chains", "Genetics"] }],
          },
          source: "system",
        },
        planId: plan.id,
        reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
        status: "applied",
      });

      const page = await openAs(browser, user);
      await page.goto("/today");

      const note = page.getByRole("region", { name: "Plan change" });

      await expect(note).toContainText("Food chains and Genetics no longer fit by your date.");
      await page.context().close();
    });
  }

  test("offers the date that covers it all after days away when no time covers the goal, and moves it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Marcos's move came forward to five days away and he missed days: even 4 hours a day can't
      // cover his goal by then, while his 25 minutes cover it all by a later date.
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const soon = new Date(toUTCMidnight(new Date()).getTime() + SOON_DAYS * MS_PER_DAY);

      await prisma.goal.update({ data: { targetDate: soon }, where: { id: user.goalId } });

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind: {
            canFocus: false,
            coveredAfter: 0.1,
            coveredBefore: 0.12,
            currentMinutes: 25,
            dailyMinutes: 240,
            fittingDate: "2028-09-28",
            fullDepth: false,
            maximumShare: 0.49,
            measure: "goal",
          },
          days: 3,
          source: "system",
        },
        planId: plan.id,
        reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
        status: "applied",
      });

      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });

      await expect(
        note.getByText("At 25 min a day, your plan now covers 10% of your goal, down from 12%."),
      ).toBeVisible();

      await expect(
        note.getByText(/^At 25 min a day, your plan covers everything by .+\.$/u),
      ).toBeVisible();

      // One way to cover it all, as the plan's notice offers: no 4 hours a day to switch to.
      await expect(note.getByRole("button", { name: /^Study .+ a day/u })).toHaveCount(0);
      await expect(note.getByRole("link", { name: "Study everything" })).toHaveCount(0);

      await note.getByRole("button", { name: "Move your date to cover everything" }).click();

      await expect
        .poll(async () => {
          const moved = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return (moved.targetDate?.getTime() ?? 0) > soon.getTime();
        })
        .toBe(true);

      await expect(note.getByRole("status")).toBeVisible();
    });
  });

  // Rafaela's card said "about 54%" while her Journey said "about 55%": the plan moved after the
  // morning's settle. Today offers the time the plan recommends now, the Journey's own number.
  test("offers more time a day as the Journey recommends it now, whatever the missed days said", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind: {
            canFocus: false,
            coveredAfter: 0.8,
            coveredBefore: 0.9,
            currentMinutes: 25,
            dailyMinutes: 300,
            fittingDate: null,
            fullDepth: true,
            maximumShare: null,
            measure: "goal",
          },
          days: 3,
          source: "system",
        },
        planId: plan.id,
        reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
        status: "applied",
      });

      await page.goto("/journey");

      const advice = page
        .getByRole("main")
        .getByText(/^To study everything in depth: .+ a day\.$/u)
        .first();

      await expect(advice).toBeVisible();

      const time = /^To study everything in depth: (?<time>.+) a day\.$/u.exec(
        (await advice.textContent()) ?? "",
      )?.groups?.time;

      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });

      await expect(
        note.getByRole("button", { name: `Study ${time} a day · everything in depth` }),
      ).toBeVisible();

      await expect(note.getByRole("button", { name: /^Study 5h a day/u })).toHaveCount(0);
    });
  });

  test("asks before moving the phase dates, says what moves, and Keep mine keeps them", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Interview English ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Opening the interview ${suffix}` }),
    ]);

    // A plan the planner doesn't own, so no refresh replaces the proposal while Today opens.
    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: toUTCMidnight(new Date()),
      titleSnapshot: lesson.title,
    });

    // Lessons written since took less time than planned in the first phase: keeping its end leaves
    // three lessons out by the goal's date, and moving it a day earlier fits them in.
    const change = await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 3,
          lessonsRemoved: 0,
          phaseEnds: [{ after: "2099-10-22", before: "2099-10-23", name: "First interviews" }],
        },
        operations: [{ kind: "fitPhaseDates" }],
        source: "phaseDates",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Suggested change" });

    await expect(note).toContainText(
      "Some lessons take more or less time than planned. Moving your phase dates fits more of them before your goal's date.",
    );

    await expect(note).toContainText(
      "Adds 3 lessons. First interviews ends October 22, 2099 instead of October 23, 2099.",
    );

    await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();

    await note.getByRole("button", { name: "Keep mine" }).click();
    await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");
    await expect.poll(() => readChangeStatus(change.id)).toBe("declined");
    await page.context().close();
  });

  // An IELTS learner's card said lessons were skipped, then that one topic no longer fits and
  // eight now fit, in one paragraph. What the skip moves reads as two labeled lines under it.
  test("lists the topics a test-out brings in and leaves out under the lessons it skipped, and why listening basics left", async ({
    browser,
  }) => {
    const { items, plan, user } = await createChapterPlan();
    const skipped = items.slice(0, 2).map((item) => item.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: skipped } },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await planChangeFixture({
      kind: "testedOut",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 12,
          lessonsRemoved: 2,
          listeningPastBasics: ["Listening"],
          topicsAdded: [
            {
              area: "Reading",
              topics: ["Writer's stance", "Locating details", "Matching headings", "Gist"],
            },
          ],
          topicsLeftOut: [
            { area: "Listening", topics: ["Spoken sounds"] },
            { area: "Reading", topics: ["References in a text"] },
          ],
        },
        planItemIds: skipped,
        source: "system",
        versionAfter: version,
      },
      planId: plan.id,
      reason: "Placement or a test-out skipped lessons the learner already knows.",
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(
      note.getByText(
        "Now in your plan: Writer's stance, Locating details, Matching headings and 1 more topic.",
      ),
    ).toBeVisible();

    await expect(
      note.getByText("Out of your plan: Spoken sounds and References in a text."),
    ).toBeVisible();

    // Placement asked no listening: the card says why its basics left and how they're checked.
    await expect(
      note.getByText(
        "Your answers show you know the basics of Listening. Practice with recordings will check them.",
      ),
    ).toBeVisible();

    await expect(note.getByText(/fits? by your date/u)).toHaveCount(0);
    await page.context().close();
  });

  test("says which chapter a test-out skipped and puts its lessons back on Undo", async ({
    browser,
  }) => {
    const { chapter, items, plan, user } = await createChapterPlan();
    const skipped = items.slice(0, 2).map((item) => item.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: skipped } },
    });

    // The plan re-plans around the skip when Today first opens, as the test-out does right away.
    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const change = await planChangeFixture({
      kind: "testedOut",
      payload: { planItemIds: skipped, source: "system", versionAfter: version },
      planId: plan.id,
      reason: "Placement or a test-out skipped lessons the learner already knows.",
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });
    await expect(note).toContainText(`We skipped 2 lessons of ${chapter.title}`);
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();

    await note.getByRole("button", { name: "Undo" }).click();
    await expect(note.getByRole("status")).toHaveText("The lessons are back in your plan.");

    await expect.poll(() => readChangeStatus(change.id)).toBe("undone");

    await expect
      .poll(() => prisma.planItem.count({ where: { id: { in: skipped }, status: "todo" } }))
      .toBe(skipped.length);

    // Answered, it leaves Today.
    await page.reload();
    await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);
    await page.context().close();
  });
});
