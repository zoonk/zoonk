import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { applyLessonActivityPlan, planLessonActivities } from "./lesson-activity-plan";
import { type LessonScreen, type LessonSpec } from "./lesson-spec-rules";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function screen(kind: LessonScreen["kind"], activityTemplate: string | null = null): LessonScreen {
  return {
    activityTemplate,
    brief: `A ${kind}.`,
    kind,
    skills: [0],
    visual: null,
    visualKind: activityTemplate ? "template" : "none",
  };
}

/** Hook, explanation, worked example, its practice check, a sort, a check, the application. */
function spec(): LessonSpec {
  return {
    canDo: "Print two lines",
    description: "Statements run in order.",
    estimatedMinutes: 3,
    screens: [
      screen("hook"),
      screen("explanation"),
      screen("workedExample"),
      screen("check"),
      screen("activity", "categorize"),
      screen("check"),
      screen("application"),
    ],
    skills: [
      {
        description: "Write print statements.",
        example: "print('Hi')",
        hard: true,
        name: "Print statements",
        topic: "Python",
        useCase: "A receipt.",
      },
    ],
    title: "Python statements",
  };
}

const templateIds = new Set(["codeRunner", "categorize"]);

function change(screenNumber: number, activityTemplate = "codeRunner") {
  return {
    activityTemplate,
    brief: "Fix line 2 so it prints Thanks.",
    screen: screenNumber,
    visual: null,
  };
}

describe(applyLessonActivityPlan, () => {
  it("turns the practice check into an activity and names a template on the application", () => {
    const { changes, spec: revised } = applyLessonActivityPlan({
      proposed: [change(4), change(7)],
      spec: spec(),
      templateIds,
    });

    expect(changes).toStrictEqual([
      { activityTemplate: "codeRunner", index: 3 },
      { activityTemplate: "codeRunner", index: 6 },
    ]);

    expect(revised.screens[3]).toStrictEqual({
      activityTemplate: "codeRunner",
      brief: "Fix line 2 so it prints Thanks.",
      kind: "activity",
      skills: [0],
      visual: null,
      visualKind: "template",
    });

    expect(revised.screens[6]).toMatchObject({
      activityTemplate: "codeRunner",
      kind: "application",
    });

    expect(revised.estimatedMinutes).toBeGreaterThanOrEqual(spec().estimatedMinutes);
  });

  it("changes nothing the rules don't let change", () => {
    const { changes, spec: revised } = applyLessonActivityPlan({
      proposed: [change(2), change(5), change(4, "madeUp"), change(9)],
      spec: spec(),
      templateIds,
    });

    expect(changes).toStrictEqual([]);
    expect(revised.screens).toStrictEqual(spec().screens);
  });

  it("drops a change that would show one template on two screens in a row", () => {
    const { changes, spec: revised } = applyLessonActivityPlan({
      proposed: [change(4, "categorize"), change(6)],
      spec: spec(),
      templateIds,
    });

    expect(changes).toStrictEqual([{ activityTemplate: "codeRunner", index: 5 }]);
    expect(revised.screens[3]).toStrictEqual(spec().screens[3]);
  });
});

describe(planLessonActivities, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks with the planner's activity rules and the lesson as learners see it", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ screens: [change(4)] }),
    );

    const { data, systemPrompt, userPrompt } = await planLessonActivities({
      activityTemplates: [
        { description: "Run and fix real code.", explore: false, id: "codeRunner" },
        { description: "Sort into groups.", explore: false, id: "categorize" },
      ],
      chapterTitle: "Basics",
      courseTitle: "Python",
      language: "en",
      level: "beginner",
      screens: [{ content: { question: "What prints?" }, kind: "check" }],
      spec: spec(),
    });

    expect(systemPrompt).toContain("An activity lets the learner do what the skill does");
    expect(systemPrompt).not.toContain("{{ACTIVITIES}}");
    expect(userPrompt).toContain("4. check\n   Skills: Print statements\n   Brief: A check.");
    expect(userPrompt).toContain('"question": "What prints?"');
    expect(userPrompt).toContain("- codeRunner: Run and fix real code.");
    expect(data.changes).toStrictEqual([{ activityTemplate: "codeRunner", index: 3 }]);
  });
});
