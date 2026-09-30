import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadChapterTaughtLessons } from "../curriculum/chapter-taught-lessons";
import { isChallengeIdentityKey, parseChallengeLessonSpec } from "./challenge-lesson-spec";
import { createChapterChallenge } from "./chapter-challenge";

const provenance = {
  generatedAt: new Date(),
  model: "test/outline",
  promptVersion: "test",
  runId: "test-run",
};

async function challengeFor(attrs: Parameters<typeof libraryChapterFixture>[0] = {}) {
  const chapter = await libraryChapterFixture(attrs);

  const input = {
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    language: chapter.language,
    level: chapter.level,
    ownerId: chapter.ownerId,
    provenance,
    skills: ["Read a conversion rate", "Judge a gap", "Read a conversion rate"],
    targetLanguage: chapter.targetLanguage,
  };

  return { chapter, id: await createChapterChallenge(input), input };
}

describe(createChapterChallenge, () => {
  it("adds a work case to a chapter, ready for the case writer", async () => {
    const { chapter, id } = await challengeFor({ language: "pt", title: "Testes A/B" });

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { skills: true },
      where: { id: id ?? "" },
    });

    expect(lesson).toMatchObject({
      canDo: "Tomar decisões com as habilidades deste capítulo",
      estimatedMinutes: 6,
      homeChapterId: chapter.id,
      skills: [],
      specStatus: "completed",
      title: "Desafio: Testes A/B",
    });

    expect(parseChallengeLessonSpec(lesson.spec)).toStrictEqual({
      kind: "challenge",
      skills: [
        { description: null, name: "Read a conversion rate" },
        { description: null, name: "Judge a gap" },
      ],
      variant: "work",
    });

    expect(isChallengeIdentityKey(lesson.identityKey)).toBe(true);
  });

  it("makes an overview chapter's challenge a light What if", async () => {
    const { id } = await challengeFor({ level: "overview", title: "Black holes" });
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: id ?? "" } });

    expect(lesson).toMatchObject({ estimatedMinutes: 4, title: "What if? Black holes" });
    expect(parseChallengeLessonSpec(lesson.spec)?.variant).toBe("whatIf");
  });

  it("finds the same challenge when a retried outline step adds it again", async () => {
    const { id, input } = await challengeFor();

    await expect(createChapterChallenge(input)).resolves.toBe(id);
  });

  it("keeps a private chapter's challenge private to its owner", async () => {
    const owner = await userFixture();
    const { id } = await challengeFor({ ownerId: owner.id, visibility: "private" });
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: id ?? "" } });

    expect(lesson).toMatchObject({ ownerId: owner.id, visibility: "private" });
    expect(isChallengeIdentityKey(lesson.identityKey)).toBe(true);
  });

  it("adds none to a language unit or a chapter without skills", async () => {
    const { id } = await challengeFor({ language: "pt", targetLanguage: "en" });
    const chapter = await libraryChapterFixture();

    expect(id).toBeNull();

    await expect(
      createChapterChallenge({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        language: "en",
        level: "beginner",
        ownerId: null,
        provenance,
        skills: [],
        targetLanguage: null,
      }),
    ).resolves.toBeNull();
  });
});

describe("challenges in plans", () => {
  it("are left out of the chapter's lessons unless the plan wants them", async () => {
    const [user, skill, { chapter, id }] = await Promise.all([
      userFixture(),
      skillFixture(),
      challengeFor(),
    ]);

    const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: id ?? "", position: 1 }),
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
    ]);

    const load = (withChallenges: boolean) =>
      loadChapterTaughtLessons({ skillIds: [skill.id], userId: user.id, withChallenges });

    await expect(load(true)).resolves.toMatchObject([{ lessonId: lesson.id }, { lessonId: id }]);
    await expect(load(false)).resolves.toMatchObject([{ lessonId: lesson.id }]);
    await expect(load(false)).resolves.toHaveLength(1);
  });
});
