import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { nextHeaders } from "../_test-utils/test-boundaries";
import { openMistakeLesson } from "./open-mistake-lesson";

describe("Opening a notebook lesson", () => {
  it("opens one teaching lesson when the topic has none, including concurrent taps", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const mistake = await mistakeFixture({ skillId: skill.id, userId: user.id });
    mockSession(user.id);

    const [first, second] = await Promise.all([
      openMistakeLesson(mistake.id),
      openMistakeLesson(mistake.id),
    ]);

    expect(first.status).toBe("ready");
    expect(second).toStrictEqual(first);
    await expect(prisma.lessonSkill.count({ where: { skillId: skill.id } })).resolves.toBe(1);
  });

  it("finds a lesson containing the bank question even without a lesson skill tag", async () => {
    const [user, lesson, skill] = await Promise.all([
      userFixture(),
      libraryLessonFixture(),
      skillFixture(),
    ]);

    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    await libraryStepFixture({ itemId: item.id, lessonId: lesson.id });
    const mistake = await mistakeFixture({ itemId: item.id, skillId: skill.id, userId: user.id });
    mockSession(user.id);

    await expect(openMistakeLesson(mistake.id)).resolves.toStrictEqual({
      lesson: { id: lesson.id, title: lesson.title },
      status: "ready",
    });
  });

  it("reopens the original lesson after its question was replaced", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);
    const step = await libraryStepFixture({ lessonId: lesson.id });

    const mistake = await mistakeFixture({
      snapshot: {
        answer: null,
        question: "Where does the energy go?",
        replay: {
          kind: "lesson",
          lesson: {
            language: lesson.language,
            lessonId: lesson.id,
            level: lesson.level,
            step: { id: step.id, skillId: null },
            targetLanguage: null,
          },
        },
      },
      stepId: step.id,
      userId: user.id,
    });

    await prisma.step.delete({ where: { id: step.id } });
    mockSession(user.id);

    await expect(openMistakeLesson(mistake.id)).resolves.toStrictEqual({
      lesson: { id: lesson.id, title: lesson.title },
      status: "ready",
    });
  });

  it("keeps a lesson based on an orphaned question private and only opens it for its owner", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const snapshot = {
      answer: "Density",
      explanation: "Metal carries heat away faster.",
      image: {
        alt: "A metal spoon and a wooden spoon on the same table",
        height: null,
        url: "/spoons.png",
        width: null,
      },
      question: "Why does one spoon feel colder than the other?",
    };

    const goal = await goalFixture({ language: "es", userId: owner.id });
    const studySession = await studySessionFixture({ goalId: goal.id, userId: owner.id });
    const attempt = await attemptFixture({ studySessionId: studySession.id, userId: owner.id });
    const mistake = await mistakeFixture({ attemptId: attempt.id, snapshot, userId: owner.id });
    mockSession(other.id);
    await expect(openMistakeLesson(mistake.id)).resolves.toStrictEqual({ status: "notFound" });
    mockSession(owner.id);
    const result = await openMistakeLesson(mistake.id);
    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Expected a lesson");
    }

    const row = await prisma.lesson.findUniqueOrThrow({ where: { id: result.lesson.id } });
    expect(row).toMatchObject({ language: "es", ownerId: owner.id, visibility: "private" });
    expect(row.description).toContain(snapshot.explanation);
    expect(row.description).toContain(snapshot.image.alt);
    nextHeaders.headers.mockResolvedValue(new Headers({ "accept-language": "pt" }));
    await expect(openMistakeLesson(mistake.id)).resolves.toStrictEqual(result);
  });
});
