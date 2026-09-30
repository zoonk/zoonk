import { randomUUID } from "node:crypto";
import * as decisionTask from "@zoonk/ai/tasks/v2/identity/decision";
import * as searchTermsTask from "@zoonk/ai/tasks/v2/identity/search-terms";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { type CreateLibraryLessonInput, createLibraryLesson } from "./create-library-lesson";

function testProvenance() {
  return {
    generatedAt: new Date("2026-09-01T12:00:00Z"),
    model: "test/writer",
    promptVersion: "test-v1",
    runId: randomUUID(),
  };
}

async function lessonInput(
  overrides: Partial<CreateLibraryLessonInput> = {},
): Promise<CreateLibraryLessonInput> {
  const skill = await skillFixture();

  return {
    description: "Work out a price after a markdown",
    estimatedMinutes: 3,
    homeChapterId: null,
    identityKey: `test-lesson-${randomUUID()}`,
    language: "en",
    level: "beginner",
    ownerId: null,
    provenance: testProvenance(),
    skillIds: [skill.id],
    targetLanguage: null,
    title: "Markdowns",
    ...overrides,
  };
}

describe(createLibraryLesson, () => {
  it("creates a public outline with its skills and the task's provenance", async () => {
    const input = await lessonInput();
    const { created, lesson } = await createLibraryLesson(input);

    expect(created).toBe(true);

    expect(lesson).toMatchObject({
      contentStatus: "pending",
      generatedAt: input.provenance.generatedAt,
      identityKey: input.identityKey,
      model: "test/writer",
      ownerId: null,
      promptVersion: "test-v1",
      runId: input.provenance.runId,
      slug: "markdowns",
      visibility: "public",
    });

    await expect(
      prisma.lessonSkill.findMany({ where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject(input.skillIds.map((skillId) => ({ skillId })));
  });

  it("returns the existing row for a known identity instead of creating another", async () => {
    const input = await lessonInput();
    const first = await createLibraryLesson(input);
    const second = await createLibraryLesson({ ...input, provenance: testProvenance() });

    expect(second).toStrictEqual({ created: false, lesson: first.lesson });
  });

  it("gives repeated titles in one home chapter distinct slugs", async () => {
    const chapter = await libraryChapterFixture();
    const title = `Tax ${randomUUID()}`;

    const [first, second] = await Promise.all([
      lessonInput({ homeChapterId: chapter.id, title }),
      lessonInput({ homeChapterId: chapter.id, title }),
    ]);

    const firstLesson = await createLibraryLesson(first);
    const secondLesson = await createLibraryLesson(second);

    expect(secondLesson.lesson.slug).toBe(`${firstLesson.lesson.slug}-2`);
  });

  it("makes a private lesson only under its owner's key and home", async () => {
    const owner = await userFixture();

    const privateChapter = await libraryChapterFixture({
      ownerId: owner.id,
      visibility: "private",
    });

    const publicChapter = await libraryChapterFixture();
    const key = `test-lesson-${randomUUID()}`;

    await expect(
      createLibraryLesson(await lessonInput({ identityKey: key, ownerId: owner.id })),
    ).rejects.toThrow("key space");

    await expect(
      createLibraryLesson(
        await lessonInput({
          homeChapterId: publicChapter.id,
          identityKey: scopeIdentityKey({ key, ownerId: owner.id }),
          ownerId: owner.id,
        }),
      ),
    ).rejects.toThrow("same visibility");

    const { lesson } = await createLibraryLesson(
      await lessonInput({
        homeChapterId: privateChapter.id,
        identityKey: scopeIdentityKey({ key, ownerId: owner.id }),
        ownerId: owner.id,
      }),
    );

    expect(lesson).toMatchObject({ ownerId: owner.id, visibility: "private" });
  });
});

describe("one row per lesson identity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gives two concurrent requests for the same lesson one row", async () => {
    const skill = await skillFixture();

    /**
     * Model calls are the only mocked boundary (the gateway is blocked in
     * tests). Search terms hold both requests until each has missed the exact
     * match, so both reach creation together and only the unique identity key
     * decides. If one request is slow enough to find the other's row by text
     * search instead, the decision reuses it, which also yields one row.
     */
    const bothSearched = Promise.withResolvers<null>();
    const arrivals: string[] = [];

    vi.spyOn(searchTermsTask, "generateSearchTerms").mockImplementation(async ({ subjects }) => {
      arrivals.push("searched");

      if (arrivals.length === 2) {
        bothSearched.resolve(null);
      }

      await bothSearched.promise;
      return { data: { subjects: subjects.map(() => ({ terms: [] })) } } as never;
    });

    vi.spyOn(decisionTask, "decideLibraryIdentity").mockImplementation(({ candidates }) =>
      Promise.resolve({
        match: candidates[0] ? { id: candidates[0].id, model: "test/jev", probability: 1 } : null,
        verdicts: [],
      }),
    );

    const request = {
      course: null,
      description: "Round a price to the nearest cent",
      kind: "lesson" as const,
      language: "en",
      level: "beginner" as const,
      skills: [{ id: skill.id, name: skill.name }],
      targetLanguage: null,
      title: `Rounding ${randomUUID()}`,
    };

    async function resolveAndCreate() {
      const resolution = await resolveLibraryIdentity({ request });

      if (resolution.kind === "existing") {
        return { created: false, id: resolution.id };
      }

      const { created, lesson } = await createLibraryLesson({
        ...request,
        estimatedMinutes: 3,
        homeChapterId: null,
        identityKey: resolution.identityKey,
        ownerId: null,
        provenance: testProvenance(),
        skillIds: [skill.id],
      });

      return { created, id: lesson.id };
    }

    const results = await Promise.all([resolveAndCreate(), resolveAndCreate()]);

    const identityKey = buildLessonIdentityKey({
      courseId: null,
      level: "beginner",
      skillIds: [skill.id],
      targetLanguage: null,
    });

    expect(results[0]?.id).toBe(results[1]?.id);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    await expect(prisma.lesson.count({ where: { identityKey } })).resolves.toBe(1);
  });
});
