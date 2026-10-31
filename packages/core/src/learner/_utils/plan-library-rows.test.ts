import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { getLessonSkillRows, toIdKey } from "../../library/_utils/shared-rows";
import {
  readChapterTitles,
  readItemSkillRows,
  readSkillEdges,
  readSkillLevels,
  readSurvivorOf,
} from "./plan-library-rows";

vi.mock("../../library/_utils/shared-rows", async (importOriginal) => {
  const actual = await importOriginal<{ getLessonSkillRows: typeof getLessonSkillRows }>();
  return { ...actual, getLessonSkillRows: vi.fn(actual.getLessonSkillRows) };
});

async function chapterWithLesson(title: string) {
  const [chapter, lesson, skill] = await Promise.all([
    libraryChapterFixture({ title }),
    libraryLessonFixture({ title }),
    skillFixture({ name: title }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { chapterId: chapter.id, lessonId: lesson.id, skillId: skill.id };
}

function byId<T extends { id: string }>(list: T[]) {
  return list.toSorted((first, second) => first.id.localeCompare(second.id));
}

function chapterSkillIds(rows: Awaited<ReturnType<typeof readItemSkillRows>>) {
  return rows.chapterLessons.flatMap((row) => row.lesson.skills.map((skill) => skill.skillId));
}

describe("the skill projection's Library rows on a GET", () => {
  it("reads a lesson another app places in a planned chapter on the next read", async () => {
    const first = await chapterWithLesson("Ratios");

    const before = await readItemSkillRows(
      { chapterIds: [first.chapterId], lessonIds: [] },
      "shared",
    );

    const [lesson, skill] = await Promise.all([
      libraryLessonFixture({ title: "Ratios, part 2" }),
      skillFixture({ name: "Ratios, part 2" }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: first.chapterId, lessonId: lesson.id, position: 1 }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    vi.mocked(getLessonSkillRows).mockClear();

    const after = await readItemSkillRows(
      { chapterIds: [first.chapterId], lessonIds: [] },
      "shared",
    );

    expect({ after: chapterSkillIds(after), before: chapterSkillIds(before) }).toStrictEqual({
      after: [first.skillId, skill.id],
      before: [first.skillId],
    });

    expect(vi.mocked(getLessonSkillRows)).toHaveBeenCalledWith(
      toIdKey([first.lessonId, lesson.id]),
    );
  });

  it("reads the same rows as a write's fresh reads", async () => {
    const [planned, chapter, other] = await Promise.all([
      chapterWithLesson("Fractions"),
      chapterWithLesson("Decimals"),
      skillFixture({ name: "Percentages" }),
    ]);

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: planned.skillId, skillId: other.id },
    });

    const lessonInput = { chapterIds: [chapter.chapterId], lessonIds: [planned.lessonId] };
    const skillIds = [planned.skillId, chapter.skillId, other.id];
    const chapterIds = [planned.chapterId, chapter.chapterId];

    const read = async (from: "shared" | typeof prisma) => {
      const [rows, survivorOf, titles, edges, levels] = await Promise.all([
        readItemSkillRows(lessonInput, from),
        readSurvivorOf(skillIds, from),
        readChapterTitles(chapterIds, from),
        readSkillEdges(skillIds, from),
        readSkillLevels(skillIds, from),
      ]);

      return {
        edges,
        levels: byId(levels),
        rows,
        survivors: skillIds.map((id) => survivorOf(id)),
        titles: byId(titles),
      };
    };

    await expect(read("shared")).resolves.toStrictEqual(await read(prisma));
  });
});
