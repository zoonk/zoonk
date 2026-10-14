import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { TEST_TUTOR_LINKS } from "../_test-utils/tutor-links";
import { generateGoalTutorAnswer } from "./goal-tutor";
import { LOOKUP_DEADLINE_MS } from "./goal-tutor-lookup";
import { formatGoalTutorPageGuide } from "./goal-tutor-pages";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./goal-tutor.prompt.md", () => ({ default: "Tutor every goal." }));
vi.mock("./goal-tutor-exam.prompt.md", () => ({ default: "Read the exam's notice." }));
vi.mock("./goal-tutor-chapter.prompt.md", () => ({ default: "Read the chapter." }));
vi.mock("./goal-tutor-lesson.prompt.md", () => ({ default: "Don't give the answer away." }));
vi.mock("./goal-tutor-mock.prompt.md", () => ({ default: "Read the mock's result." }));
vi.mock("./goal-tutor-subject.prompt.md", () => ({ default: "Read the subject." }));
vi.mock("./goal-tutor-item.prompt.md", () => ({ default: "Read the question." }));
vi.mock("./goal-tutor-search", () => ({ shouldSearchFirst: vi.fn(async () => false) }));

vi.mock("../../../gateway", () => ({
  zoonkGateway: { tools: { parallelSearch: vi.fn(() => ({})) } },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

/** The app's pages with the host's links, after the goal's instructions. */
const PAGES = `## The app's pages\n\n${formatGoalTutorPageGuide({ pages: TEST_TUTOR_LINKS.pages, selectedGoal: false })}\n`;

/** The instructions a call reads, in order: the goal's, the app's pages, then a screen's. */
function instructions(goal: string[], screen?: string) {
  return [...goal, PAGES, ...(screen ? [screen] : [])].join("\n");
}

function planContext(kind: string): PlanScopeContext {
  return {
    course: null,
    estimate: { endDate: null, remainingHours: 10 },
    goal: { dailyMinutes: 30, kind, targetDate: null, title: "Goal" },
    language: "en",
    next: [],
    phase: null,
    scope: { kind: "plan" },
    status: null,
    today: null,
    version: 1,
  };
}

function answer(text: string) {
  const result = createGenerateTextResult(null, "openai/gpt-6-luna");
  return { ...result, steps: [{ ...result.finalStep, text, toolCalls: [] }] } as typeof result;
}

async function getInstructions(
  kind: string,
  screen?: PlanScopeContext["screen"],
): Promise<unknown> {
  vi.mocked(generateText).mockResolvedValueOnce(answer("Sure."));

  const { systemPrompt } = await generateGoalTutorAnswer({
    contextSnapshot: { ...planContext(kind), screen },
    links: TEST_TUTOR_LINKS,
    lookUp: vi.fn(),
    offerAppTool: vi.fn(),
    priorTurns: [],
    proposePlanChange: vi.fn(),
    question: "Why this today?",
  });

  expect(vi.mocked(generateText).mock.lastCall?.[0].instructions).toBe(systemPrompt);
  return systemPrompt;
}

/** The instructions for a question about the plan, in the open goal's conversation or not. */
async function readPagesPrompt(selectedGoal?: true) {
  const { systemPrompt } = await generateGoalTutorAnswer({
    contextSnapshot: { ...planContext("learn"), ...(selectedGoal && { selectedGoal }) },
    links: TEST_TUTOR_LINKS,
    lookUp: vi.fn(),
    offerAppTool: vi.fn(),
    priorTurns: [],
    proposePlanChange: vi.fn(),
    question: "Where do I see my plan?",
  });

  return systemPrompt;
}

describe(generateGoalTutorAnswer, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the exam's instructions only for an exam goal", async () => {
    await expect(getInstructions("exam")).resolves.toBe(
      instructions(["Tutor every goal.", "Read the exam's notice."]),
    );

    await expect(getInstructions("learn")).resolves.toBe(instructions(["Tutor every goal."]));
    await expect(getInstructions("language")).resolves.toBe(instructions(["Tutor every goal."]));
  });

  it("adds a screen's instructions only when the learner asked from that screen", async () => {
    const chapter = { scope: { kind: "chapter" } } as NonNullable<PlanScopeContext["screen"]>;
    const step = { scope: { kind: "step" } } as NonNullable<PlanScopeContext["screen"]>;
    const mock = { scope: { kind: "mock" } } as NonNullable<PlanScopeContext["screen"]>;

    await expect(getInstructions("learn", chapter)).resolves.toBe(
      instructions(["Tutor every goal."], "Read the chapter."),
    );

    await expect(getInstructions("learn", step)).resolves.toBe(
      instructions(["Tutor every goal."], "Don't give the answer away."),
    );

    await expect(getInstructions("exam", mock)).resolves.toBe(
      instructions(["Tutor every goal.", "Read the exam's notice."], "Read the mock's result."),
    );
  });

  it("lists the pages of the goal the app has open only in the buddy's own conversation about it", async () => {
    vi.mocked(generateText).mockResolvedValue(answer("Sure."));

    await expect(readPagesPrompt(true)).resolves.toContain("- /plan: ");
    await expect(readPagesPrompt()).resolves.not.toContain("- /plan: ");
    await expect(readPagesPrompt()).resolves.toContain("- /settings: ");
  });

  it("waits for a lookup only until its deadline and leaves room for a lookup, a card and the answer", async () => {
    await getInstructions("learn");
    const options = vi.mocked(generateText).mock.lastCall?.[0];

    expect(options?.timeout).toStrictEqual({ tools: { lookUpMs: LOOKUP_DEADLINE_MS } });

    const prepareStep = options?.prepareStep;

    const step = (stepNumber: number) =>
      prepareStep?.({ stepNumber, steps: [] } as unknown as Parameters<
        NonNullable<typeof prepareStep>
      >[0]);

    await expect(step(2)).resolves.toStrictEqual({});
    await expect(step(3)).resolves.toStrictEqual({ toolChoice: "none" });
  });

  it("can't search in the steps after it looked up the learner's data", async () => {
    await getInstructions("learn");
    const prepareStep = vi.mocked(generateText).mock.lastCall?.[0].prepareStep;

    const afterLookUp = await prepareStep?.({
      stepNumber: 1,
      steps: [{ toolCalls: [{ toolName: "lookUp" }] }],
    } as unknown as Parameters<NonNullable<typeof prepareStep>>[0]);

    expect(afterLookUp).toStrictEqual({
      activeTools: ["offerAppTool", "proposePlanChange", "lookUp"],
    });
  });
});
