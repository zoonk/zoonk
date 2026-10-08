import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "../../view-models/language/get-language-progress-view";
import { getLanguageUnitView } from "../../view-models/language/get-language-unit-view";
import { getLanguageUnitsView } from "../../view-models/language/get-language-units-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A unit the course gained while it was being written, which the learner's plan doesn't hold. */
async function addUnplannedUnit(courseId: string) {
  const chapter = await libraryChapterFixture({
    language: "pt",
    level: "advanced",
    targetLanguage: "en",
    title: "Inglês acadêmico",
  });

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    language: "pt",
    targetLanguage: "en",
    title: "Escrevendo um artigo",
  });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, level: "advanced", position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  return chapter;
}

describe("language units", () => {
  it("are the units the plan holds, so every screen counts the same ones", async () => {
    const { course, goal, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const unplanned = await addUnplannedUnit(course.id);

    const [units, progress, unplannedPage] = await Promise.all([
      getLanguageUnitsView({ goalId: goal.id }),
      getLanguageProgressView({ goalId: goal.id }),
      getLanguageUnitView({ chapterId: unplanned.id, goalId: goal.id }),
    ]);

    // Progress's "I can already" reads the same units: the unplanned one's objectives never show.

    expect(units.status === "ready" && units.units.units.map((unit) => unit.title)).toStrictEqual([
      "Chegando",
      "Alugando um apartamento",
    ]);

    expect(
      progress.status === "ready" && progress.progress.canDo.map((item) => item.unitTitle),
    ).toStrictEqual(["Chegando"]);

    expect(unplannedPage.status === "ready" && unplannedPage.unit.unit.position).toBeNull();

    const rentingPage = await getLanguageUnitView({ chapterId: renting.id, goalId: goal.id });
    expect(rentingPage.status === "ready" && rentingPage.unit.unit.position).toBe(2);
  });

  it("follow the plan's order", async () => {
    const { goal, items, user } = await languageGoalFixture();
    mockSession(user.id);

    // The plan moved the arriving unit's lessons after the renting unit's.
    await Promise.all(
      items
        .slice(0, 2)
        .map((item, index) =>
          prisma.planItem.update({ data: { position: 10 + index }, where: { id: item.id } }),
        ),
    );

    const units = await getLanguageUnitsView({ goalId: goal.id });

    expect(
      units.status === "ready" &&
        units.units.units.map((unit) => ({ position: unit.position, title: unit.title })),
    ).toStrictEqual([
      { position: 1, title: "Alugando um apartamento" },
      { position: 2, title: "Chegando" },
    ]);
  });
});
