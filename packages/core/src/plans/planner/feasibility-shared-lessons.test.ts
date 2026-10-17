import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { getCoverage } from "./feasibility-coverage";
import { fromIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";
import { toSizedPlanInput } from "./sized-plan";

function sharedLessonInput({
  lessonMinutes = [3],
  weekdayMinutes = [0, 0, 0, 0, 0, 15, 0],
}: { lessonMinutes?: readonly number[]; weekdayMinutes?: number[] } = {}): BuildPlanInput {
  return {
    courseStart: true,
    goal: { dailyMinutes: 15, kind: "learn", targetDate: fromIsoDate("2020-09-29") },
    graph: {
      phases: [{ milestone: null, name: "Shared concepts" }],
      skills: ["a", "b", "c"].map((skillId) => ({
        area: "Science",
        lessons: lessonMinutes.length,
        name: skillId,
        outlined: true,
        phase: 0,
        skillId,
        weight: 1,
      })),
    },
    items: [],
    lessons: lessonMinutes.map((minutes, index) => ({
      chapterId: "shared-chapter",
      lessonId: `shared-${index}`,
      minutes,
      skillIds: ["a", "b", "c"],
      title: `Shared lesson ${index}`,
    })),
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2020-09-27", weekdayMinutes }),
    today: fromIsoDate("2020-09-28"),
  };
}

describe("outlined shared lesson feasibility", () => {
  it("covers no skill when the one lesson teaching all three misses the deadline", () => {
    const input = sharedLessonInput();
    const sized = toSizedPlanInput(input);
    const built = buildPlan(sized.input);
    const coverage = getCoverage({ built, examSubjects: null, sized });

    expect(built.items.filter((item) => item.kind === "lesson")).toHaveLength(0);
    expect(built.skillMinutes.every((skill) => !skill.standIn)).toBe(true);

    expect(coverage.skillFits).toStrictEqual(
      new Map([
        ["a", 0],
        ["b", 0],
        ["c", 0],
      ]),
    );

    expect(coverage.coveredShare).toBe(0);
    expect(getPlanFeasibility({ input }).coveredShare).toBe(0);
  });

  it("measures partial shared coverage by written learning minutes instead of assignment ownership", () => {
    const input = sharedLessonInput({
      lessonMinutes: [3, 9],
      weekdayMinutes: [0, 5, 0, 0, 0, 0, 0],
    });

    const sized = toSizedPlanInput(input);
    const built = buildPlan(sized.input);
    const coverage = getCoverage({ built, examSubjects: null, sized });

    expect(
      built.items.filter((item) => item.kind === "lesson").map((item) => item.lessonId),
    ).toStrictEqual(["shared-0"]);

    expect(built.skillMinutes.every((skill) => !skill.standIn)).toBe(true);
    expect([...coverage.skillFits.values()]).toStrictEqual([0.25, 0.25, 0.25]);
    expect(coverage.coveredShare).toBe(0.25);
  });

  it("covers all three skills while scheduling their shared lesson only once", () => {
    const input = sharedLessonInput({ weekdayMinutes: [0, 60, 0, 0, 0, 0, 0] });
    const sized = toSizedPlanInput(input);
    const built = buildPlan(sized.input);
    const coverage = getCoverage({ built, examSubjects: null, sized });

    expect(built.items.filter((item) => item.kind === "lesson")).toHaveLength(1);
    expect(built.skillMinutes.every((skill) => !skill.standIn)).toBe(true);
    expect([...coverage.skillFits.values()]).toStrictEqual([1, 1, 1]);
    expect(coverage.coveredShare).toBe(1);
  });

  it("keeps a tested-out skill covered without declaring the other shared skills known", () => {
    const input = sharedLessonInput();

    const withTestOut: BuildPlanInput = {
      ...input,
      items: [
        {
          chapterId: "shared-chapter",
          completedAt: input.today,
          id: "test-out",
          kind: "lesson",
          lessonId: "shared-0",
          phase: 0,
          position: 0,
          scheduledFor: input.today,
          skillId: "a",
          status: "testedOut",
          titleSnapshot: "Shared lesson 0",
        },
      ],
    };

    const sized = toSizedPlanInput(withTestOut);
    const built = buildPlan(sized.input);
    const coverage = getCoverage({ built, examSubjects: null, sized });

    expect(coverage.skillFits).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 0],
        ["c", 0],
      ]),
    );

    expect(coverage.coveredShare).toBeCloseTo(1 / 3);
  });
});
