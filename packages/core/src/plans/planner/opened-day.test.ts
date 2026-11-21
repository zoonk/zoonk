import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { parsePlanSettings } from "./plan-state";
import { listSelectedItemFacts } from "./selected-item-facts";

const TODAY = fromIsoDate("2026-10-01");

function lesson(lessonId: string, skillId: string) {
  return {
    chapterId: `chapter-${skillId}`,
    lessonId,
    minutes: 4,
    skillIds: [skillId],
    title: lessonId,
  };
}

function saved(lessonId: string, skillId: string, attrs: Partial<ExistingPlanItem>) {
  return {
    chapterId: `chapter-${skillId}`,
    completedAt: null,
    id: lessonId,
    kind: "lesson" as const,
    lessonId,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId,
    status: "todo" as const,
    titleSnapshot: lessonId,
    ...attrs,
  };
}

const ONLY_A = [{ area: null, lessons: 3, name: "A", phase: 0, skillId: "A", weight: null }];

const A_AND_B = [
  ...ONLY_A,
  { area: null, lessons: 2, name: "B", phase: 0, skillId: "B", weight: null },
];

const LEARN = {
  goal: { dailyMinutes: 20, kind: "learn" as const, targetDate: null },
  settings: {},
};

/** A full-course exam goal whose exam has passed, so today is on the days after it. */
const AFTER_EXAM = {
  goal: { dailyMinutes: 20, kind: "exam" as const, targetDate: fromIsoDate("2026-09-28") },
  settings: { fullCourse: true },
};

/** The saved plan dates B's lessons; today's re-plan may plan skill B differently, or not at all. */
function comeBack({
  goal,
  openedKeys,
  skills,
}: {
  goal: typeof LEARN | typeof AFTER_EXAM;
  openedKeys: string[];
  skills: typeof A_AND_B;
}): BuildPlanInput {
  const items = [
    saved("a1", "A", {
      completedAt: fromIsoDate("2026-09-29"),
      scheduledFor: fromIsoDate("2026-09-29"),
      status: "done",
    }),
    saved("b1", "B", { scheduledFor: fromIsoDate("2026-09-30") }),
    saved("a2", "A", { scheduledFor: TODAY }),
    saved("b2", "B", { scheduledFor: fromIsoDate("2026-10-02") }),
    saved("a3", "A", { scheduledFor: fromIsoDate("2026-10-03") }),
  ].map((item, position) => ({ ...item, position }));

  return {
    goal: goal.goal,
    graph: { phases: [{ milestone: null, name: "Only" }], skills },
    items,
    lessons: [
      lesson("a1", "A"),
      lesson("b1", "B"),
      lesson("a2", "A"),
      lesson("b2", "B"),
      lesson("a3", "A"),
    ],
    mockMinutes: 150,
    mode: "forced",
    openedKeys,
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    setAsideLeftWork: true,
    settings: parsePlanSettings({ ...goal.settings, startDate: "2026-09-29" }),
    today: TODAY,
    todayShown: true,
  };
}

function statusOf(built: ReturnType<typeof buildPlan>, key: string) {
  const item = built.items.find((entry) => entry.key === key);
  return item ? [item.status, item.scheduledFor && toIsoDate(item.scheduledFor)] : null;
}

const DAYS = [
  {
    name: "a day with left work and a later lesson",
    opened: ["lesson:b1", "lesson:a2", "lesson:b2"],
  },
  { name: "a light welcome-back day of left work", opened: ["lesson:b1"] },
];

const CASES = [
  { goal: LEARN, plan: "a learn goal", skills: ONLY_A },
  { goal: LEARN, plan: "a learn goal still planning B", skills: A_AND_B },
  { goal: AFTER_EXAM, plan: "the days after a full-course exam", skills: ONLY_A },
  { goal: AFTER_EXAM, plan: "the days after a full-course exam still planning B", skills: A_AND_B },
].flatMap((plan) => DAYS.map((day) => ({ ...plan, ...day })));

describe("the day the learner opened", () => {
  it.each(CASES)("stays whole on today: $name, on $plan", ({ goal, opened, skills }) => {
    const built = buildPlan(comeBack({ goal, openedKeys: opened, skills }));

    expect(opened.map((key) => statusOf(built, key))).toStrictEqual(
      opened.map(() => ["todo", "2026-10-01"]),
    );
  });
});

describe("the day the learner opened is all of today", () => {
  it.each(CASES)("dates nothing else on today: $name, on $plan", ({ goal, opened, skills }) => {
    const built = buildPlan(comeBack({ goal, openedKeys: opened, skills }));

    const today = built.items.flatMap((item) =>
      item.kind === "lesson" && item.scheduledFor && toIsoDate(item.scheduledFor) === "2026-10-01"
        ? [item.key]
        : [],
    );

    expect(today.toSorted()).toStrictEqual(opened.toSorted());
  });
});

describe("an opened lesson the re-plan no longer plans", () => {
  it("takes the time its saved plan gave it, the same as when the planner still loads it", () => {
    const input = {
      ...comeBack({ goal: LEARN, openedKeys: ["lesson:b1", "lesson:a2"], skills: A_AND_B }),
      paceFactor: 1.5,
    };

    const facts = listSelectedItemFacts({ built: buildPlan(input), input });

    const withoutB = {
      ...input,
      graph: { ...input.graph, skills: ONLY_A },
      items: input.items.map((item) => ({
        ...item,
        facts: { ...facts.get(getItemKey(item)), schemaVersion: 1 },
      })),
    };

    const layout = (lessons: BuildPlanInput["lessons"]) => {
      const built = buildPlan({ ...withoutB, lessons });

      return {
        items: built.items.map((item) => [
          item.key,
          item.status,
          item.scheduledFor && toIsoDate(item.scheduledFor),
        ]),
        minutes: Object.fromEntries(built.lessonRawMinutes.get("lesson:b1") ?? []),
      };
    };

    expect(layout(withoutB.lessons.filter((entry) => entry.lessonId !== "b1"))).toStrictEqual(
      layout(withoutB.lessons),
    );
  });

  it("isn't taught a second time by another lesson with its title", () => {
    const input = comeBack({ goal: LEARN, openedKeys: ["lesson:b1"], skills: ONLY_A });
    const twin = { ...lesson("a0", "A"), title: "B1 " };
    const built = buildPlan({ ...input, lessons: [twin, ...input.lessons] });

    expect(statusOf(built, "lesson:a0")).toBeNull();
    expect(statusOf(built, "lesson:b1")).toStrictEqual(["todo", "2026-10-01"]);
  });
});
