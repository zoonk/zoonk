import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it } from "vitest";
import { holdLearnerRevision, waitForBlockedStatement } from "../../_test-utils/learner-revision";
import { languageLessonDraft } from "../language/_test-utils/language-lesson-draft";
import { saveLanguageLesson } from "../language/_utils/save-language-lesson";
import { pullLessonForFix } from "../quality/later-reviews";
import { createHomeChapterLessons, createLibraryLesson } from "./create-library-lesson";

const WRITERS = ["publication", "creation", "pull"] as const;
type Writer = (typeof WRITERS)[number];

/** Pre-cut dependencies, a merged identity, and legacy lesson/chapter/course links. */
async function selectionScope() {
  const [first, second, untouched, skill, course, chapter] = await Promise.all([
    userFixture(),
    userFixture(),
    userFixture(),
    skillFixture(),
    courseFixture(),
    libraryChapterFixture(),
  ]);

  const [alias, lesson] = await Promise.all([
    skillFixture({ mergedIntoId: skill.id }),
    libraryLessonFixture({
      contentRunId: randomUUID(),
      contentStatus: "running",
      language: "pt",
      targetLanguage: "en",
    }),
  ]);

  const [step] = await Promise.all([
    libraryStepFixture({ lessonId: lesson.id, version: 1 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
  ]);

  const goals = await Promise.all([
    goalFixture({ userId: first.id }),
    goalFixture({ userId: first.id }),
    goalFixture({ userId: second.id }),
    goalFixture({ userId: second.id }),
    goalFixture({ userId: second.id }),
    goalFixture({ primaryCourseId: course.id, userId: second.id }),
    goalFixture({ userId: untouched.id }),
  ]);

  // The skills each plan's build read, as it saves them: its graph's, its items' and its lessons'.
  const sources = [[skill.id], [alias.id], [skill.id], [skill.id], [skill.id], [skill.id], []];

  const plans = await Promise.all(
    goals.map((goal, index) =>
      planFixture({
        goalId: goal.id,
        graph: { skills: index === 1 ? [{ skillId: alias.id }] : [] },
        sourceSkillIds: sources[index],
      }),
    ),
  );

  await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plans[2]!.id }),
    planItemFixture({ planId: plans[3]!.id, skillId: skill.id }),
    planItemFixture({ chapterId: chapter.id, planId: plans[4]!.id }),
  ]);

  return { chapter, first, lesson, plans, second, skill, step, untouched };
}

type Scope = Awaited<ReturnType<typeof selectionScope>>;

async function versions({ plans, first, second, untouched }: Scope) {
  const [savedPlans, users] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: plans.map(({ id }) => id) } },
    }),
    prisma.user.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: [first.id, second.id, untouched.id] } },
    }),
  ]);

  return {
    plans: savedPlans.map(({ id, inputVersion, version }) => ({ id, inputVersion, version })),
    users: users.map(({ id, learnerRevision }) => ({ id, learnerRevision })),
  };
}

function changedVersions({
  before,
  scope,
  writes,
  holder = false,
}: {
  before: Awaited<ReturnType<typeof versions>>;
  scope: Scope;
  writes: number;
  holder?: boolean;
}) {
  return {
    plans: before.plans.map((plan) => ({
      ...plan,
      inputVersion: plan.inputVersion + (plan.id === scope.plans[6]!.id ? 0 : writes),
    })),
    users: before.users.map((user) => ({
      ...user,
      learnerRevision:
        user.learnerRevision +
        BigInt(user.id === scope.untouched.id ? 0 : writes) +
        BigInt(holder && user.id === scope.first.id),
    })),
  };
}

function creationInput(scope: Scope) {
  return {
    description: "Recognize a rent question",
    estimatedMinutes: 3,
    homeChapterId: scope.chapter.id,
    identityKey: `sibling-${randomUUID()}`,
    language: "pt",
    level: "beginner" as const,
    ownerId: null,
    provenance: {
      generatedAt: new Date(),
      model: "test",
      promptVersion: "test",
      runId: randomUUID(),
    },
    skillIds: [scope.skill.id],
    targetLanguage: "en",
    title: `Sibling ${randomUUID()}`,
  };
}

function publicationInput(scope: Scope) {
  return {
    content: languageLessonDraft(),
    lessonId: scope.lesson.id,
    provenance: {
      generatedAt: new Date(),
      model: "test",
      promptVersion: "test",
      runId: randomUUID(),
    },
    sentenceIds: [],
    skillId: scope.skill.id,
    steps: [
      {
        content: { text: "Recognize a rent question", title: "Rent" },
        kind: "explanation" as const,
        sentenceId: null,
        wordId: null,
      },
    ],
    wordIds: [],
    workflowRunId: scope.lesson.contentRunId!,
  };
}

async function prepareWriter(scope: Scope, writer: Writer) {
  if (writer === "creation") {
    const input = creationInput(scope);
    return () => createLibraryLesson(input).then(({ created }) => created);
  }

  if (writer === "pull") {
    await prisma.lesson.update({
      data: { contentStatus: "completed" },
      where: { id: scope.lesson.id },
    });

    return () => pullLessonForFix(scope.lesson.id);
  }

  const publication = publicationInput(scope);
  return () => saveLanguageLesson(publication);
}

async function lessonState(scope: Scope) {
  return prisma.lesson.findUniqueOrThrow({
    include: {
      sentences: true,
      steps: { orderBy: [{ version: "asc" }, { position: "asc" }] },
      words: true,
    },
    where: { id: scope.lesson.id },
  });
}

describe("D5 sibling writer admission", () => {
  it.each(WRITERS)(
    "%s marks every dependent plan and each owner once, with no replay bump",
    async (writer) => {
      const scope = await selectionScope();
      const write = await prepareWriter(scope, writer);
      const before = await versions(scope);
      await expect(write()).resolves.toBe(true);

      await expect(versions(scope)).resolves.toStrictEqual(
        changedVersions({ before, scope, writes: 1 }),
      );

      const stored = await lessonState(scope);
      await expect(write()).resolves.toBe(false);

      await expect(versions(scope)).resolves.toStrictEqual(
        changedVersions({ before, scope, writes: 1 }),
      );

      await expect(lessonState(scope)).resolves.toStrictEqual(stored);

      const retired = expect.any(Date);

      const expectedSteps =
        writer === "publication"
          ? [
              { id: scope.step.id, retiredAt: retired, version: 1 },
              { retiredAt: null, version: 2 },
            ]
          : [{ id: scope.step.id, retiredAt: null, version: 1 }];

      expect(stored.steps).toMatchObject(expectedSteps);
    },
  );

  it.each(WRITERS)(
    "%s takes plan/user admission before domain locks and rolls back the duplicate contender",
    async (writer) => {
      const scope = await selectionScope();
      const write = await prepareWriter(scope, writer);
      const before = await versions(scope);

      const holder = holdLearnerRevision({
        beforeCommit: async (tx) => {
          await tx.$queryRaw`SELECT id FROM library_lessons WHERE id = ${scope.lesson.id}::uuid FOR UPDATE`;
        },
        userId: scope.first.id,
      });

      const pid = await holder.pid;
      const calls = Promise.all([write(), write()]);

      try {
        await waitForBlockedStatement(pid, /SELECT id FROM users/u);
        await waitForBlockedStatement(pid, /SELECT plan.id, goal.user_id/u);
      } finally {
        holder.release();
        await Promise.all([holder.done, calls]);
      }

      const results = await calls;
      expect(results.toSorted()).toStrictEqual([false, true]);

      await expect(versions(scope)).resolves.toStrictEqual(
        changedVersions({ before, holder: true, scope, writes: 1 }),
      );
    },
  );

  it.each(["publication", "pull"] as const)(
    "%s rolls all admission and content changes back when its claim is lost",
    async (writer) => {
      const scope = await selectionScope();
      const write = await prepareWriter(scope, writer);
      const before = await versions(scope);
      const replacement = randomUUID();
      const stored = await lessonState(scope);

      const holder = holdLearnerRevision({
        beforeCommit: async (tx) => {
          await tx.lesson.update({
            data: { contentRunId: replacement, contentStatus: "running" },
            where: { id: scope.lesson.id },
          });
        },
        userId: scope.first.id,
      });

      const pid = await holder.pid;
      const pending = write();

      try {
        await waitForBlockedStatement(pid, /SELECT id FROM users/u);
      } finally {
        holder.release();
        await Promise.all([holder.done, pending]);
      }

      await expect(pending).resolves.toBe(false);

      await expect(versions(scope)).resolves.toStrictEqual(
        changedVersions({ before, holder: true, scope, writes: 0 }),
      );

      const after = await lessonState(scope);

      expect(after).toMatchObject({
        contentRunId: replacement,
        contentStatus: "running",
        sentences: stored.sentences,
        steps: stored.steps,
        summary: stored.summary,
        words: stored.words,
      });
    },
  );

  it("rolls publication and all dependent marks back when a real step FK fails", async () => {
    const scope = await selectionScope();
    const before = await versions(scope);
    const stored = await lessonState(scope);

    await expect(
      saveLanguageLesson({ ...publicationInput(scope), skillId: randomUUID() }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(versions(scope)).resolves.toStrictEqual(before);
    await expect(lessonState(scope)).resolves.toStrictEqual(stored);
  });

  it("rolls insertion and all dependent marks back when a real skill FK fails", async () => {
    const scope = await selectionScope();
    const input = { ...creationInput(scope), skillIds: [scope.skill.id, randomUUID()] };
    const before = await versions(scope);
    await expect(createLibraryLesson(input)).rejects.toMatchObject({ code: "P2003" });
    await expect(versions(scope)).resolves.toStrictEqual(before);

    await expect(prisma.lesson.count({ where: { identityKey: input.identityKey } })).resolves.toBe(
      0,
    );
  });

  it("keeps invalid private identity and home refusals outside admission", async () => {
    const scope = await selectionScope();
    const before = await versions(scope);
    const input = { ...creationInput(scope), ownerId: scope.first.id };
    await expect(createLibraryLesson(input)).rejects.toThrow("key space");

    await expect(
      createLibraryLesson({
        ...input,
        identityKey: scopeIdentityKey({ key: input.identityKey, ownerId: input.ownerId }),
      }),
    ).rejects.toThrow("same visibility");

    await expect(versions(scope)).resolves.toStrictEqual(before);
  });

  it("marks each batch insertion once and rolls back every duplicate batch attempt", async () => {
    const scope = await selectionScope();
    const inputs = [creationInput(scope), creationInput(scope)];
    const before = await versions(scope);

    const write = () =>
      createHomeChapterLessons({ homeChapterId: scope.chapter.id, lessons: inputs, ownerId: null });

    const first = await write();
    expect(first.every(({ created }) => created)).toBe(true);

    await expect(versions(scope)).resolves.toStrictEqual(
      changedVersions({ before, scope, writes: inputs.length }),
    );

    const retry = await write();

    expect(retry.map(({ created, lesson }) => ({ created, id: lesson.id }))).toStrictEqual(
      first.map(({ lesson }) => ({ created: false, id: lesson.id })),
    );

    await expect(versions(scope)).resolves.toStrictEqual(
      changedVersions({ before, scope, writes: inputs.length }),
    );
  });

  it("retains slug-conflict retries without committing a marker for the losing insertion attempt", async () => {
    const scope = await selectionScope();
    const first = creationInput(scope);
    const second = { ...creationInput(scope), title: first.title };
    const before = await versions(scope);
    const holder = holdLearnerRevision({ userId: scope.first.id });
    const pid = await holder.pid;
    const calls = Promise.all([createLibraryLesson(first), createLibraryLesson(second)]);

    try {
      await waitForBlockedStatement(pid, /SELECT id FROM users/u);
      await waitForBlockedStatement(pid, /SELECT plan.id, goal.user_id/u);
    } finally {
      holder.release();
      await Promise.all([holder.done, calls]);
    }

    const results = await calls;
    expect(results.every(({ created }) => created)).toBe(true);
    expect(new Set(results.map(({ lesson }) => lesson.slug)).size).toBe(2);

    await expect(versions(scope)).resolves.toStrictEqual(
      changedVersions({ before, holder: true, scope, writes: 2 }),
    );
  });
});
