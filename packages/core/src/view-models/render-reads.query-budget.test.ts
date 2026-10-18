import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { signedInCourseGoal } from "./_test-utils/course-goal";
import { getChapterView } from "./chapter/get-chapter-view";
import { getLanguageProgressView } from "./language/get-language-progress-view";
import { getLanguageTodayView } from "./language/get-language-today-view";
import { getLanguageUnitView } from "./language/get-language-unit-view";
import { getLanguageUnitsView } from "./language/get-language-units-view";
import { getFieldMapView } from "./map/get-field-map-view";
import { getPlanTabView } from "./plan/get-plan-view";
import { getProgressView } from "./progress/get-progress-view";
import { getSyllabusView } from "./syllabus/get-syllabus-view";

describe("render read statement budgets", () => {
  it.each([
    ["plan", getPlanTabView, 20],
    ["progress", getProgressView, 87],
    ["syllabus", getSyllabusView, 16],
    ["map", getFieldMapView, 26],
  ] as const)("keeps the read budget for %s", async (_name, read, budget) => {
    await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({}));
    assertReadBudget(counts, budget);
    expect(counts.result.status).toBe("ready");
  });

  it("keeps the read budget for chapter", async () => {
    const { chapters } = await signedInCourseGoal();

    const counts = await countDatabaseStatements(async () =>
      getChapterView({ chapterId: chapters[0]!.id }),
    );

    assertReadBudget(counts, 42);
    expect(counts.result.status).toBe("ready");
  });

  it.each([
    ["language progress", getLanguageProgressView, 23],
    ["language units", getLanguageUnitsView, 8],
    ["language today", getLanguageTodayView, 21],
  ] as const)("keeps the read budget for %s", async (_name, read, budget) => {
    const { user } = await languageGoalFixture();
    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read({}));
    assertReadBudget(counts, budget);
    expect(counts.result.status).toBe("ready");
  });

  it("keeps the read budget for language unit", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);

    const counts = await countDatabaseStatements(async () =>
      getLanguageUnitView({ chapterId: renting.id }),
    );

    assertReadBudget(counts, 26);
    expect(counts.result.status).toBe("ready");
  });
});
