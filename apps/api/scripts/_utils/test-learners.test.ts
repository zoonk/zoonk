import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { listSeedEmails } from "@zoonk/db/seed/emails";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findTestLearners, getTestLearnerRefusal, removeTestLearner } from "./test-learners";

const LOCAL_DATABASE_URL = "postgresql://postgres:secret@localhost:5432/zoonk";

describe(getTestLearnerRefusal, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    LOCAL_DATABASE_URL,
    "postgresql://postgres:secret@127.0.0.1:5432/zoonk",
    "postgresql://postgres:secret@localhost:5432/zoonk_wt_0123456789ab_dev",
  ])("allows the local development database %s", (databaseUrl) => {
    vi.stubEnv("DATABASE_URL", databaseUrl);

    expect(getTestLearnerRefusal()).toBeNull();
  });

  it.each([
    "postgresql://postgres:secret@localhost:5432/zoonk_test",
    "postgresql://postgres:secret@localhost:5432/zoonk_e2e",
    "postgresql://postgres:secret@localhost:5432/zoonk_wt_0123456789ab_test",
    "postgresql://postgres:secret@ep-example.us-east-2.aws.neon.tech/zoonk",
    "postgresql://postgres:secret@localhost:5432/zoonk?host=production.example.invalid",
    "",
  ])("refuses any other database, without repeating its URL: %s", (databaseUrl) => {
    vi.stubEnv("DATABASE_URL", databaseUrl);

    const refusal = getTestLearnerRefusal();

    expect(refusal).toMatch(/local development database/u);
    expect(refusal).not.toContain("secret");
  });

  it.each([
    ["VERCEL_ENV", "preview"],
    ["VERCEL_ENV", "production"],
    ["E2E_TESTING", "true"],
  ])("refuses outside development (%s=%s), even on the local database", (name, value) => {
    vi.stubEnv("DATABASE_URL", LOCAL_DATABASE_URL);
    vi.stubEnv(name, value);

    expect(getTestLearnerRefusal()).toMatch(/not development/u);
  });
});

describe(findTestLearners, () => {
  it("lists every account and guest the seed didn't write, never a seeded one or the owner's", async () => {
    const keptEmails = [...listSeedEmails(), "will3@zoonk.test"];

    const [learner, guest] = await Promise.all([
      userFixture(),
      prisma.user.create({
        data: { email: `guest-${randomUUID()}@example.test`, isAnonymous: true, name: "Guest" },
      }),
      /**
       * The persona tests seed the same accounts at the same time: insert only the ones still
       * missing, in one statement that waits for their writes instead of failing on them.
       */
      prisma.user.createMany({
        data: keptEmails.map((email) => ({ email, name: "Kept" })),
        skipDuplicates: true,
      }),
    ]);

    const learners = await findTestLearners();
    const emails = learners.map(({ email }) => email);

    expect(emails).toStrictEqual(expect.arrayContaining([learner.email, guest.email]));
    expect(emails.filter((email) => keptEmails.includes(email))).toStrictEqual([]);
  });
});

describe(removeTestLearner, () => {
  it("removes everything of the learner's and keeps the shared Library their plan used", async () => {
    const learner = await userFixture();

    const [shared, own, goal] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [2] }),
      privateCourseFixture({ lessonCounts: [2], ownerId: learner.id }),
      goalFixture({ userId: learner.id }),
      usageRecordsFixture({ count: 2, userId: learner.id }),
      // No foreign key ties billing to the user, so only the account deletion's cleanup removes it.
      prisma.subscription.create({
        data: { plan: "plus", referenceId: learner.id, status: "active" },
      }),
    ]);

    const plan = await planFixture({ goalId: goal.id });
    const sharedLessonIds = shared.lessons.flat().map((lesson) => lesson.id);
    const ownLessonIds = own.lessons.flat().map((lesson) => lesson.id);

    await planItemFixture({ lessonId: sharedLessonIds[0], planId: plan.id });

    await removeTestLearner(learner);

    const [removed, kept] = await Promise.all([
      Promise.all([
        prisma.user.count({ where: { id: learner.id } }),
        prisma.goal.count({ where: { userId: learner.id } }),
        prisma.usageRecord.count({ where: { userId: learner.id } }),
        prisma.subscription.count({ where: { referenceId: learner.id } }),
        prisma.course.count({ where: { id: own.course.id } }),
        prisma.lesson.count({ where: { id: { in: ownLessonIds } } }),
      ]),
      Promise.all([
        prisma.course.count({ where: { id: shared.course.id } }),
        prisma.lesson.count({ where: { id: { in: sharedLessonIds } } }),
      ]),
    ]);

    expect(removed).toStrictEqual([0, 0, 0, 0, 0, 0]);
    expect(kept).toStrictEqual([1, 2]);
  });
});
