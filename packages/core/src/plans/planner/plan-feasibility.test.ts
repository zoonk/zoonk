import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { type ExistingPlanItem } from "./plan-items";
import { getExamWindows } from "./plan-phases";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Monday. */
const TODAY = fromIsoDate("2026-09-28");

function skill(skillId: string, attrs: Partial<PlanGraphSkill> = {}): PlanGraphSkill {
  return {
    area: null,
    lessons: 2,
    name: `Skill ${skillId}`,
    phase: 0,
    skillId,
    weight: null,
    ...attrs,
  };
}

function lessonsFor(skillId: string, count: number, minutes = 3): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: "chapter",
    lessonId: `${skillId}-${index}`,
    minutes,
    skillIds: [skillId],
    title: `Lesson ${skillId} ${index}`,
  }));
}

function planInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-12") },
    graph: { phases: [{ milestone: null, name: "Everything" }], skills: [skill("s1")] },
    items: [],
    lessons: [],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
    today: TODAY,
    ...attrs,
  };
}

function plannedLesson(lessonId: string, skillId: string): ExistingPlanItem {
  return {
    chapterId: "chapter",
    completedAt: null,
    id: lessonId,
    kind: "lesson",
    lessonId,
    phase: 0,
    position: 0,
    scheduledFor: TODAY,
    skillId,
    status: "todo",
    titleSnapshot: `Lesson ${lessonId}`,
  };
}

describe(getPlanFeasibility, () => {
  // Ana moved her exam from 400 days away to 36, two weeks into her foundations: the plan keeps the
  // phase she's in open, so its final stretch starts November 10, where a calendar from the plan's
  // start puts it on November 7 (see `getKeptExamWindows`). What the plan covers is counted up to
  // its own final stretch, so that's the deadline it says.
  // A plan that studies everything goes on after the exam with what doesn't fit before it: those
  // topics come after the exam, so it says, as without it, that not every topic is in by then.
  it("counts a topic in only when it gets lesson time before the deadline", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

    const input = planInput({
      goal: { dailyMinutes: 10, kind: "exam", targetDate: fromIsoDate("2026-10-26") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: ids.map((id) => skill(id, { area: id.toUpperCase(), lessons: 3 })),
      },
      lessons: ids.flatMap((id) => lessonsFor(id, 3, 15)),
    });

    const byExam = getPlanFeasibility({ input });

    const everything = getPlanFeasibility({
      input: { ...input, settings: { ...input.settings, fullCourse: true } },
    });

    expect({ byExam: byExam.coreFits, everything: everything.coreFits }).toStrictEqual({
      byExam: false,
      everything: false,
    });
  });

  it("says the deadline its share is measured to when an exam's moved date keeps its phases", () => {
    const planStart = fromIsoDate("2026-09-26");

    const feasibility = getPlanFeasibility({
      input: planInput({
        examWindows: getExamWindows({ planStart, targetDate: fromIsoDate("2027-11-14") }),
        goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-11-15") },
        graph: {
          phases: [{ milestone: null, name: "Everything" }],
          skills: [skill("s1", { lessons: 8 })],
        },
        lessons: lessonsFor("s1", 8),
        settings: parsePlanSettings({ startDate: "2026-09-26" }),
        today: fromIsoDate("2026-10-10"),
      }),
    });

    expect(feasibility.deadline && toIsoDate(feasibility.deadline)).toBe("2026-11-10");
  });

  it("counts an exam's coverage by what its subjects are worth, and other skills for nothing", () => {
    // 60 minutes of lessons in all, 36 of them before the deadline (two days at 30).
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-09-30") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [
          skill("math-1", { area: "Math", lessons: 6, weight: 3 }),
          skill("math-2", { area: "Math", lessons: 6, weight: 1 }),
          skill("law", { area: "Law", lessons: 6, weight: 1 }),
          skill("strategy", { area: "Study strategy", lessons: 2, weight: 1 }),
        ],
      },
    });

    const examSubjects = [
      { areas: ["Math"], share: 0.75 },
      { areas: ["Law"], share: 0.25 },
    ];

    const exam = getPlanFeasibility({ examSubjects, input });
    const fits = exam.skillFits;
    const mathFit = (3 * (fits.get("math-1") ?? 0) + (fits.get("math-2") ?? 0)) / 4;

    // Math is 75% of the exam, shared 3 to 1 by weight; Law's 25% counts what of it fits.
    expect(exam.measure).toBe("exam");
    expect(exam.coveredShare).toBeCloseTo(0.75 * mathFit + 0.25 * (fits.get("law") ?? 0), 5);
    expect(exam.coveredShare).toBeGreaterThan(0);
    expect(exam.coveredShare).toBeLessThan(1);

    // Without the notice's subjects, each skill counts its weight.
    const goal = getPlanFeasibility({ input });

    const byWeight = [...goal.skillFits].reduce(
      (sum, [skillId, fit]) => sum + fit * (skillId === "math-1" ? 3 : 1),
      0,
    );

    expect(goal.measure).toBe("goal");
    expect(goal.coveredShare).toBeCloseTo(byWeight / 6, 5);
  });

  it("measures the plan it holds before and after the Library outlines its stand-ins", () => {
    const graph = {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [skill("s1", { lessons: 40 }), skill("s2", { lessons: 40 })],
    };

    const placeholders = planInput({ graph });

    // The outline wrote fewer, longer lessons than the graph's estimate, in a different order.
    const written = planInput({
      graph,
      lessons: [...lessonsFor("s2", 30, 5), ...lessonsFor("s1", 25, 4)],
    });

    const before = getPlanFeasibility({ input: placeholders });
    const after = getPlanFeasibility({ input: written });

    // Each measures the lessons it plans: the share moves as estimates become written lessons.
    for (const feasibility of [before, after]) {
      expect(feasibility.coveredShare).toBeGreaterThan(0);
      expect(feasibility.coveredShare).toBeLessThan(1);
      expect(feasibility.fits).toBe(false);
    }
  });

  it("counts the lessons the learner finished as covered, and a skill they settled whole", () => {
    const graph = {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [skill("s1", { lessons: 40 }), skill("s2", { lessons: 40 })],
    };

    const fresh = getPlanFeasibility({ input: planInput({ graph }) });

    const studied = getPlanFeasibility({
      input: planInput({
        graph,
        items: Array.from({ length: 10 }, (_, index) => ({
          ...plannedLesson(`s1-${index}`, "s1"),
          status: "done" as const,
        })),
        lessons: lessonsFor("s1", 40),
      }),
    });

    const settled = getPlanFeasibility({
      input: planInput({
        graph,
        items: [{ ...plannedLesson("s2-0", "s2"), lessonId: null, status: "testedOut" }],
      }),
    });

    expect(studied.coveredShare).toBeGreaterThan(fresh.coveredShare);
    expect(settled.skillFits.get("s2")).toBe(1);
    expect(settled.coveredShare).toBeGreaterThan(fresh.coveredShare);
  });

  it("counts lessons the plan set aside for time as left, and ones the Library held back as gone", () => {
    // The Library outlined s1's 40 lessons: what it holds back from them leaves the skill.
    const graph = {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [skill("s1", { lessons: 40, outlined: true }), skill("s2", { lessons: 40 })],
    };

    const lessons = lessonsFor("s1", 40);

    const aside = Array.from({ length: 30 }, (_, index) => ({
      ...plannedLesson(`s1-${index}`, "s1"),
      status: "skipped" as const,
    }));

    const fresh = getPlanFeasibility({ input: planInput({ graph, lessons }) });

    // A new day's settling set 30 lessons aside: they're still left, and the plan as it stands
    // covers none of them (a change brings them back).
    const setAside = getPlanFeasibility({ input: planInput({ graph, items: aside, lessons }) });

    // The Library couldn't write them: they left the plan's lessons, and nothing will teach them.
    const heldBack = getPlanFeasibility({
      input: planInput({ graph, items: aside, lessons: lessons.slice(30) }),
    });

    expect(setAside.coveredShare).toBeLessThanOrEqual(fresh.coveredShare);
    expect(setAside.fits).toBe(false);
    expect(heldBack.coveredShare).toBeGreaterThan(fresh.coveredShare);
  });

  it("weighs another daily time as switching plans it, from today, this week included", () => {
    // A test on Thursday, this week's lessons already planned: re-planning at more time fits all.
    const input = planInput({
      goal: { dailyMinutes: 6, kind: "learn", targetDate: fromIsoDate("2026-10-01") },
      graph: {
        phases: [{ milestone: null, name: "Cells" }],
        skills: [skill("s1", { lessons: 12 })],
      },
      items: [plannedLesson("s1-0", "s1"), plannedLesson("s1-1", "s1")],
      lessons: lessonsFor("s1", 12),
      mode: "automatic",
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility.fits).toBe(false);
    expect(feasibility.recommendedMinutes).not.toBeNull();

    const switched = {
      ...input,
      goal: { ...input.goal, dailyMinutes: feasibility.recommendedMinutes ?? 0 },
      mode: "forced" as const,
    };

    expect(buildPlan(switched).droppedSkillIds).toStrictEqual([]);
  });

  it("offers no switch to more time when more time covers nothing more", () => {
    // The deadline is today: no daily time adds a study day.
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "learn", targetDate: TODAY },
      graph: {
        phases: [{ milestone: null, name: "Cells" }],
        skills: [skill("s1", { lessons: 12 })],
      },
      lessons: lessonsFor("s1", 12),
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility).toMatchObject({ fits: false, maximum: null, recommendedMinutes: null });
  });

  it("says the most time a day covers everything when all but a sliver fits at it", () => {
    // At 4 h a day, all but a lesson or two of the light skill fits before the deadline (the final
    // challenge takes their place): that reads as 100%.
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-10-03") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [
          skill("s1", { lessons: 2, weight: 300 }),
          skill("s2", { lessons: 199, weight: 1 }),
        ],
      },
    });

    const atMost = getPlanFeasibility({
      input: { ...input, goal: { ...input.goal, dailyMinutes: 240 } },
    });

    // Only a sliver doesn't fit at the most time a day.
    expect(atMost.fits).toBe(false);
    expect(Math.round(atMost.coveredShare * 100)).toBe(100);

    expect(getPlanFeasibility({ input })).toMatchObject({
      fits: false,
      maximum: null,
      recommendedMinutes: 240,
    });
  });

  it("studies every skill, the ones worth more in more depth, while every core fits", () => {
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-10-12") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [skill("s1", { lessons: 60, weight: 3 }), skill("s2", { lessons: 60, weight: 1 })],
      },
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility).toMatchObject({ coreFits: true, coreMinutes: null, fits: false });
    expect(feasibility.recommendedMinutes).toBeGreaterThan(30);
    expect(feasibility.skillFits.get("s2")).toBeGreaterThan(0);
  });

  it("says the time that brings every skill in when even the cores don't fit", () => {
    const skills = Array.from({ length: 8 }, (_, index) =>
      skill(`s${index}`, { lessons: 60, weight: 8 - index }),
    );

    const input = planInput({
      goal: { dailyMinutes: 10, kind: "learn", targetDate: fromIsoDate("2026-10-05") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility.coreFits).toBe(false);
    expect(feasibility.coreMinutes).toBeGreaterThan(10);
    expect(feasibility.coreMinutes).toBeLessThan(feasibility.recommendedMinutes ?? 241);

    const atCoreMinutes = getPlanFeasibility({
      input: { ...input, goal: { ...input.goal, dailyMinutes: feasibility.coreMinutes ?? 0 } },
    });

    expect(atCoreMinutes.coreFits).toBe(true);
  });
});
