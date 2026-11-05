import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
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

describe("render reads", () => {
  it.each([
    ["plan", getPlanTabView],
    ["progress", getProgressView],
    ["syllabus", getSyllabusView],
    ["map", getFieldMapView],
  ] as const)("reads %s without writing", async (_name, read) => {
    await signedInCourseGoal();
    const counts = await countDatabaseStatements(async () => read({}));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("reads chapter without writing", async () => {
    const { chapters } = await signedInCourseGoal();

    const counts = await countDatabaseStatements(async () =>
      getChapterView({ chapterId: chapters[0]!.id }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it.each([
    ["language progress", getLanguageProgressView],
    ["language units", getLanguageUnitsView],
    ["language today", getLanguageTodayView],
  ] as const)("reads %s without writing", async (_name, read) => {
    const { user } = await languageGoalFixture();
    mockSession(user.id);
    const counts = await countDatabaseStatements(async () => read({}));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("reads language unit without writing", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);

    const counts = await countDatabaseStatements(async () =>
      getLanguageUnitView({ chapterId: renting.id }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });
});
