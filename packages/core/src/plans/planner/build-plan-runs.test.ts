import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { getFittedStandInLessons } from "./plan-effect";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/*
 * A run on the plan an earlier run saved: what it keeps, carries and brings back, on a plan of a few
 * skills.
 */

/** A Monday. */
const TODAY = fromIsoDate("2026-10-12");

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

function lesson(lessonId: string, skillIds: string[], chapterId = "chapter"): PlannerLesson {
  return { chapterId, lessonId, minutes: 3, skillIds, title: `Lesson ${lessonId}` };
}

/** A skill's lessons in a chapter of its own. */
function lessonsOf(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) =>
    lesson(`${skillId}${index}`, [skillId], skillId),
  );
}

function planInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 12, kind: "learn", targetDate: null },
    graph: { phases: [{ milestone: null, name: "Only" }], skills: [] },
    items: [],
    lessons: [],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
    ...attrs,
  };
}

type StoredItem = ExistingPlanItem & Pick<PlannedItem, "key">;
type Items = { items: readonly Pick<StoredItem, "key" | "kind" | "scheduledFor" | "status">[] };

/** The plan as stored: each item with its id (its key) and position. */
function store(plan: { items: readonly PlannedItem[] }): StoredItem[] {
  return plan.items.map((item, position) => ({ ...item, id: item.id ?? item.key, position }));
}

/** Each item's key, status and day. */
function layout(plan: Items) {
  return plan.items.map((item) => [
    item.key,
    item.status,
    item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
  ]);
}

function findItem(plan: Items, key: string) {
  return plan.items.find((item) => item.key === key);
}

function listLessonKeys(plan: Items): string[] {
  return plan.items.flatMap((item) => (item.kind === "lesson" ? [item.key] : []));
}

describe("an automatic run with a stand-in this week", () => {
  // ENEM: a lesson the Library wrote for two skills counts for the first, whose other lessons the
  // plan holds. Read as written for the stand-in's skill too, an automatic run took the stand-in
  // out of this week (see `splitExistingItems`).
  it("keeps it on its day when its skill shares a lesson the plan counts for another", () => {
    const input = planInput({
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [
          skill("y", { lessons: 3 }),
          skill("x", { lessons: 1 }),
          skill("z", { lessons: 6 }),
        ],
      },
      lessons: [lesson("y0", ["y"]), lesson("y1", ["y"])],
    });

    const saved = store(buildPlan(input));

    const next = buildPlan({
      ...input,
      items: saved,
      lessons: [...input.lessons, lesson("shared", ["y", "x"], "y-chapter")],
      mode: "automatic",
    });

    expect(findItem(next, "skill:x")?.scheduledFor).toStrictEqual(
      findItem({ items: saved }, "skill:x")?.scheduledFor,
    );
  });

  // A language plan short on time cut a stand-in to 32 of its 96 lessons. Counted whole, it took
  // the time of 96 past this week, and a refresh at the learner's pace moved everything after it
  // past the goal's date (see `getKeptShare`).
  it("counts only the part of it the plan keeps", () => {
    const input = planInput({
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-11-01") },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [
          skill("s1", { area: "A", lessons: 60 }),
          skill("s2", { area: "B", lessons: 12 }),
          skill("s3", { area: "C", lessons: 12 }),
        ],
      },
      lessons: [...lessonsOf("s2", 12), ...lessonsOf("s3", 12)],
    });

    const built = buildPlan(input);

    // The stand-in is saved with the lessons of it that fit, as `commitPlan` saves it.
    const fitted = getFittedStandInLessons({
      skillMinutes: built.skillMinutes,
      standInLessons: new Map([["s1", 60]]),
    }).get("s1");

    const saved = store(built).map((item) =>
      item.key === "skill:s1" ? { ...item, lessons: fitted ?? null } : item,
    );

    // A session at a faster pace re-plans what comes after this week.
    const next = buildPlan({ ...input, items: saved, mode: "automatic", paceFactor: 0.5 });

    expect(fitted).toBeLessThan(30);

    expect(listLessonKeys(next)).toStrictEqual(
      expect.arrayContaining(listLessonKeys({ items: saved })),
    );
  });
});

describe("an automatic run on a plan that studies a base with its quick lesson", () => {
  // The plan follows the order of the one with the base's core (see `followLearnedOrder`). Laid
  // out as an automatic run, that plan read the core as new work this week, laid itself out from
  // the week after, and the refresh right after a class test's new date lost six lessons.
  it("keeps the plan as it is", () => {
    const input = planInput({
      bases: [
        {
          area: "A",
          choices: ["deep", "essential", "quick", "skip"],
          known: false,
          minutes: { deep: 18, essential: 6, quick: 3 },
          name: "b",
          neededFor: ["t"],
          skillId: "b",
          studied: false,
        },
      ],
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-30") },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [
          skill("b", { area: "A", lessons: 6 }),
          skill("t", { area: "A", lessons: 12 }),
          skill("u", { area: "B", lessons: 12 }),
          skill("v", { area: "C", lessons: 12 }),
        ],
      },
      lessons: [
        ...lessonsOf("b", 6),
        ...lessonsOf("t", 12),
        ...lessonsOf("u", 12),
        ...lessonsOf("v", 12),
      ],
      prerequisites: new Map([["t", ["b"]]]),
      quickLessons: new Map([["b", lesson("bq", ["b"], "quick")]]),
      settings: parsePlanSettings({
        baseChoices: [{ choice: "quick", skillId: "b" }],
        startDate: toIsoDate(TODAY),
      }),
    });

    const saved = store(buildPlan(input));
    const next = buildPlan({ ...input, items: saved, mode: "automatic" });

    expect(layout(next)).toStrictEqual(layout({ items: saved }));
  });
});

describe("a later run on the day a settling carried earlier days' work", () => {
  // The items the settling carried are carried again (`CarryOver.itemIds`): laid out in the
  // queue's order instead, the first open of Today after an OAB plan's settling moved its lessons.
  it("lays the work out as the settling did", () => {
    const skills = [
      skill("math", { area: "Math", lessons: 30, weight: 5 }),
      skill("law", { area: "Law", lessons: 30, weight: 3 }),
      skill("reading", { area: "Portuguese", lessons: 30, weight: 1 }),
    ];

    const input = planInput({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      lessons: skills.flatMap((entry) => lessonsOf(entry.skillId, 30)),
    });

    // The learner missed the week: Sunday's settling carries it, past this week.
    const sunday = fromIsoDate("2026-10-18");
    const first = store(buildPlan(input));

    const carried = first.filter(
      (item) => item.kind === "lesson" && item.scheduledFor && item.scheduledFor < sunday,
    );

    const settled = buildPlan({
      ...input,
      carryOver: { lessonIds: [] },
      items: first,
      setAsideLeftWork: true,
      today: sunday,
    });

    const next = buildPlan({
      ...input,
      carryOver: { itemIds: carried.map((item) => item.id), lessonIds: [] },
      items: store(settled),
      mode: "automatic",
      settings: { ...input.settings, mockFunding: settled.mockFunding },
      today: sunday,
    });

    expect(layout(next)).toStrictEqual(layout(settled));
  });
});

describe("work missed days set aside", () => {
  // Two missed days before a class test set organelles aside. The learner then chose to study
  // everything, and organelles stayed out though the plan now had time for them.
  it("comes back on the learner's change that gives the plan time for it", () => {
    const input = planInput({
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-16") },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [skill("s1", { lessons: 4 }), skill("s2", { lessons: 4 })],
      },
      lessons: lessonsOf("s1", 4),
    });

    const thursday = fromIsoDate("2026-10-15");

    const settled = buildPlan({
      ...input,
      carryOver: { lessonIds: [] },
      items: store(buildPlan(input)),
      setAsideLeftWork: true,
      today: thursday,
    });

    const changed = buildPlan({
      ...input,
      bringBackSetAside: true,
      goal: { ...input.goal, targetDate: null },
      items: store(settled),
      today: thursday,
    });

    expect(findItem(settled, "skill:s2")?.status).toBe("skipped");
    expect(findItem(changed, "skill:s2")?.status).toBe("todo");
  });
});

describe("an automatic run on the plan a forced one laid out the same day", () => {
  // The lessons a stand-in this week has on each day, before and after the week's end, as funding
  // a mock and placing the challenges read them (see `layOutAfterThisWeek`): kept as this week's
  // work, an automatic run packed its time from its first day, and its challenge read that day as
  // its end, a fortnight before the forced run's.
  it("gives a long stand-in across the week's end the same lesson minutes on each day", () => {
    const wednesday = fromIsoDate("2026-10-14");

    const input = planInput({
      goal: { dailyMinutes: 15, kind: "exam", targetDate: fromIsoDate("2026-11-29") },
      graph: {
        phases: [
          { milestone: null, name: "Basics" },
          { milestone: null, name: "Core" },
        ],
        skills: [
          skill("s1", { area: "A", lessons: 20 }),
          skill("s2", { area: "B", lessons: 6, phase: 1 }),
        ],
      },
      lessons: lessonsOf("s2", 6),
      mockMinutes: 60,
      settings: parsePlanSettings({ startDate: toIsoDate(wednesday) }),
      today: wednesday,
    });

    const forced = buildPlan(input);

    const automatic = buildPlan({
      ...input,
      items: store(forced),
      mode: "automatic",
      settings: { ...input.settings, mockFunding: forced.mockFunding },
    });

    const standIn = [...(forced.lessonRawMinutes.get("skill:s1") ?? new Map()).keys()];

    expect(standIn.some((date) => date <= "2026-10-18")).toBe(true);
    expect(standIn.some((date) => date > "2026-10-18")).toBe(true);
    expect(automatic.lessonRawMinutes).toStrictEqual(forced.lessonRawMinutes);
    expect(automatic.lessonDayMinutes).toStrictEqual(forced.lessonDayMinutes);
    // This week's days give what the forced run set aside; the rest is summed again, so compare
    // the minutes past float noise.
    const rounded = (funding: typeof forced.mockFunding) =>
      funding.map((entry) => ({
        ...entry,
        contributions: entry.contributions.map((part) => ({
          ...part,
          minutes: Math.round(part.minutes * 1e6) / 1e6,
        })),
      }));

    expect(rounded(automatic.mockFunding)).toStrictEqual(rounded(forced.mockFunding));
    expect(layout(automatic)).toStrictEqual(layout(forced));
  });
});
