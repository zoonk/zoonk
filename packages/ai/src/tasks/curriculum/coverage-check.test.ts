import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkCoverage } from "./coverage-check";
import { type ExamOutline } from "./exam-outline";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

// The real instructions: a check must read only the rules and fill only the fields of its goal.
vi.mock("./coverage-check.prompt.md", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("coverage-check.prompt.md", import.meta.url), "utf8") };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const REFERENCE = { text: "Unit 3: Hypothesis testing", title: "Intro to Statistics syllabus" };

const SKILLS = [
  { description: "Mean and median.", examWeight: 2, key: "center", name: "Describe the center" },
];

const NOTICE: ExamOutline = {
  name: "SAT",
  notes: [],
  subjects: [
    { group: null, name: "Math", questions: 44, topics: ["Hypothesis testing"], weight: null },
  ],
  topicFrequency: [],
};

const MISSING = {
  description: "Decide whether data supports a claim.",
  name: "Test a hypothesis",
  prerequisites: ["center"],
  syllabusLine: "Unit 3: Hypothesis testing",
};

async function sendCheck(params: Partial<Parameters<typeof checkCoverage>[0]>) {
  const result = await checkCoverage({
    goal: "Statistics",
    goalKind: "learn",
    language: "en",
    references: [REFERENCE],
    skills: SKILLS,
    ...params,
  });

  const [call] = vi.mocked(generateText).mock.calls.map(([options]) => options);
  const output = call?.output as { responseFormat: PromiseLike<{ schema?: unknown }> } | undefined;
  const format = await output?.responseFormat;

  return {
    data: result.data,
    instructions: typeof call?.instructions === "string" ? call.instructions : "",
    schema: JSON.stringify(format?.schema),
  };
}

describe(checkCoverage, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("checks a learn goal for missing skills alone, with no exam rules or fields", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ missing: [MISSING] }));

    const { data, instructions, schema } = await sendCheck({ goalKind: "learn" });

    expect(instructions).not.toMatch(/# Exam notice|# Exam weights|`examWeight`|`placements`/u);
    expect(instructions).not.toContain("{{");
    expect(schema).not.toMatch(/examWeights|placements|"area"|"topics"/u);

    expect(data).toMatchObject({
      examWeights: [],
      missing: [{ area: null, examWeight: null, name: "Test a hypothesis", topics: [] }],
      placements: [],
    });
  });

  it("weighs an exam's skills without placing them when its notice isn't known", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        examWeights: [{ examWeight: 4, key: "center" }],
        missing: [{ ...MISSING, examWeight: 5 }],
      }),
    );

    const { data, instructions, schema } = await sendCheck({ goalKind: "exam" });

    expect(instructions).toContain("# Exam weights");
    expect(instructions).not.toMatch(/# Exam notice|`EXAM_NOTICE`|`placements`/u);
    expect(schema).toContain("examWeights");
    expect(schema).not.toMatch(/placements|"area"|"topics"/u);
    expect(data.examWeights).toStrictEqual([{ examWeight: 4, key: "center" }]);
    expect(data.missing[0]?.examWeight).toBe(5);
  });

  it("places an exam's skills in its notice and weighs them with the notice known", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        examWeights: [],
        missing: [{ ...MISSING, area: "Math", examWeight: 5, topics: ["S1.1"] }],
        placements: [],
      }),
    );

    const { instructions, schema } = await sendCheck({ examOutline: NOTICE, goalKind: "exam" });

    expect(instructions).toContain("# Exam notice");
    expect(instructions).toContain("# Exam weights");
    expect(schema).toMatch(/placements/u);
  });
});
