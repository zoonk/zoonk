import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { getAlphabetIdentityKey } from "../../library/language/alphabet/alphabet-identity";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { getLanguageUnitsView } from "../../view-models/language/get-language-units-view";
import { skipAlphabetIntro } from "./skip-alphabet-intro";

const TIME_ZONE = "UTC";

/**
 * The shared alphabet lesson of a script for Portuguese speakers, found or created: tests share
 * it, as learners do, and other files use other language pairs.
 */
async function alphabetLesson({
  contentStatus = "completed",
  targetLanguage,
}: {
  contentStatus?: "completed" | "running";
  targetLanguage: string;
}) {
  const identityKey = getAlphabetIdentityKey(targetLanguage);

  const existing = await prisma.lesson.findUnique({
    where: { languageIdentity: { identityKey, language: "pt" } },
  });

  // A lesson left by an earlier run keeps the state this test asks for.
  if (existing && existing.contentStatus !== contentStatus) {
    return prisma.lesson.update({ data: { contentStatus }, where: { id: existing.id } });
  }

  return (
    existing ??
    libraryLessonFixture({
      canDo: "Ler e dizer as cinco vogais do hiragana",
      contentStatus,
      estimatedMinutes: 5,
      identityKey,
      language: "pt",
      targetLanguage,
      title: "Seu primeiro hiragana",
    })
  );
}

const hiraganaLesson = () => alphabetLesson({ targetLanguage: "ja" });

/** A Portuguese speaker's Japanese goal with a plan, signed in. */
async function japaneseGoal() {
  const setup = await languageGoalFixture();

  const goal = await prisma.goal.update({
    data: { targetLanguage: "ja", timezone: TIME_ZONE },
    where: { id: setup.goal.id },
  });

  mockSession(setup.user.id);
  return { ...setup, goal };
}

async function unitsAlphabet(goalId: string) {
  const result = await getLanguageUnitsView({ goalId });
  return result.status === "ready" ? result.units.alphabet : undefined;
}

async function todayLessonIds(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  return {
    blocks: today.session.blocks,
    lessonIds: today.session.blocks.flatMap((block) => (block.lessonId ? [block.lessonId] : [])),
  };
}

describe("alphabet intro", () => {
  it("opens a new learner's first session with the script's alphabet lesson, before the plan", async () => {
    const [alphabet, { goal, lessons }] = await Promise.all([hiraganaLesson(), japaneseGoal()]);

    await expect(unitsAlphabet(goal.id)).resolves.toStrictEqual({
      canDo: "Ler e dizer as cinco vogais do hiragana",
      lessonId: alphabet.id,
      minutes: 5,
      pending: true,
      title: "Seu primeiro hiragana",
    });

    const { lessonIds } = await todayLessonIds(goal.id);

    expect(lessonIds[0]).toBe(alphabet.id);
    expect(lessonIds[1]).toBe(lessons[0]?.id);
  });

  it("stops opening sessions once skipped, including today's, and stays open as practice", async () => {
    const [alphabet, { goal }] = await Promise.all([hiraganaLesson(), japaneseGoal()]);
    const { blocks } = await todayLessonIds(goal.id);
    const block = blocks.find((candidate) => candidate.lessonId === alphabet.id);

    await expect(skipAlphabetIntro(goal.id)).resolves.toStrictEqual({ status: "skipped" });

    const [saved, skippedBlock] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block?.id } }),
    ]);

    expect(saved.details).toMatchObject({ alphabetIntro: "skipped", targetLevel: "B1+" });
    expect(skippedBlock.status).toBe("skipped");
    await expect(unitsAlphabet(goal.id)).resolves.toMatchObject({ pending: false });

    // Skipping again changes nothing.
    await expect(skipAlphabetIntro(goal.id)).resolves.toStrictEqual({ status: "skipped" });
  });

  it("is done once the learner finished the lesson", async () => {
    const [alphabet, { goal, user }] = await Promise.all([hiraganaLesson(), japaneseGoal()]);

    await learningEventFixture({ contentIds: { lessonId: alphabet.id }, userId: user.id });

    await expect(unitsAlphabet(goal.id)).resolves.toMatchObject({ pending: false });

    const { lessonIds } = await todayLessonIds(goal.id);
    expect(lessonIds).not.toContain(alphabet.id);
  });

  it("isn't needed when the level test shows the learner reads the script", async () => {
    const [, { goal, user }] = await Promise.all([hiraganaLesson(), japaneseGoal()]);

    await prisma.languageSkillLevel.create({
      data: { language: "ja", score: 1, skill: "reading", startScore: 1, userId: user.id },
    });

    await expect(unitsAlphabet(goal.id)).resolves.toMatchObject({ pending: false });
  });

  it("isn't shown for a Latin script or before its lesson is written", async () => {
    const [english, korean] = await Promise.all([languageGoalFixture(), languageGoalFixture()]);

    await Promise.all([
      prisma.goal.update({ data: { targetLanguage: "ko" }, where: { id: korean.goal.id } }),
      alphabetLesson({ contentStatus: "running", targetLanguage: "ko" }),
    ]);

    mockSession(english.user.id);
    await expect(unitsAlphabet(english.goal.id)).resolves.toBeNull();

    mockSession(korean.user.id);
    await expect(unitsAlphabet(korean.goal.id)).resolves.toBeNull();
  });

  it("skips only the learner's own goals in a script that isn't Latin", async () => {
    const [{ goal }, english, other] = await Promise.all([
      japaneseGoal(),
      languageGoalFixture(),
      userFixture(),
    ]);

    const topic = await goalFixture({ userId: english.user.id });

    mockSession(null);
    await expect(skipAlphabetIntro(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(other.id);
    await expect(skipAlphabetIntro(goal.id)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(english.user.id);

    await expect(skipAlphabetIntro(english.goal.id)).resolves.toStrictEqual({
      status: "notLanguage",
    });

    await expect(skipAlphabetIntro(topic.id)).resolves.toStrictEqual({ status: "notLanguage" });
  });
});

describe("alphabet skip admission", () => {
  it("marks selection once, preserves current details, and serializes a duplicate skip before block locks", async () => {
    const { goal, user, plan } = await japaneseGoal();
    const language = `x${crypto.randomUUID().slice(0, 8)}`;

    const [alphabet, session] = await Promise.all([
      libraryLessonFixture({
        contentStatus: "completed",
        identityKey: getAlphabetIdentityKey("ja"),
        language,
        targetLanguage: "ja",
      }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
      prisma.goal.update({ data: { language }, where: { id: goal.id } }),
    ]);

    const [pending, active] = await Promise.all([
      studySessionBlockFixture({
        lessonId: alphabet.id,
        position: 0,
        sessionId: session.id,
        status: "pending",
      }),
      studySessionBlockFixture({
        lessonId: alphabet.id,
        position: 1,
        sessionId: session.id,
        status: "active",
      }),
    ]);

    const holder = holdLearnerLock({
      beforeCommit: async (tx) => {
        await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${pending.id}::uuid FOR UPDATE`;

        await tx.goal.update({
          data: { details: { ...(goal.details as object), concurrent: "kept" } },
          where: { id: goal.id },
        });
      },
      userId: user.id,
    });

    const pid = await holder.pid;
    const skips = Promise.all([skipAlphabetIntro(goal.id), skipAlphabetIntro(goal.id)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
      await waitForBlockedStatement(pid, /SELECT plan.id FROM plans/u);
    } finally {
      holder.release();
      await Promise.all([holder.done, skips]);
    }

    await expect(skips).resolves.toStrictEqual([{ status: "skipped" }, { status: "skipped" }]);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { alphabetIntro: "skipped", concurrent: "kept", targetLevel: "B1+" },
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: active.id } }),
    ).resolves.toMatchObject({ status: "active" });

    await skipAlphabetIntro(goal.id);
  });

  it("rolls back admission if the goal becomes ineligible while it waits", async () => {
    const { goal, user, plan } = await japaneseGoal();

    const holder = holdLearnerLock({
      beforeCommit: async (tx) =>
        tx.goal.update({ data: { targetLanguage: "en" }, where: { id: goal.id } }),
      userId: user.id,
    });

    const pid = await holder.pid;
    const skip = skipAlphabetIntro(goal.id);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, skip]);
    }

    await expect(skip).resolves.toStrictEqual({ status: "notLanguage" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });
});
