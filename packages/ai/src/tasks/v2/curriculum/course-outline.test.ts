import { type LanguageModelUsage, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseOutlineParams, generateCourseOutline } from "./course-outline";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

// The real instructions: an outline must read only its own variants' rules and inputs.
vi.mock("./course-outline.prompt.md", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("course-outline.prompt.md", import.meta.url), "utf8") };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const BAND: CourseOutlineParams = {
  courseTitle: "Statistics",
  language: "en",
  level: "beginner",
  requiredSkills: [{ description: "Mean and median.", key: "center", name: "Describe the center" }],
};

const EXTEND_SKILL = {
  chapters: [{ lessons: ["Mean", "Median"], title: "Center" }],
  description: "Mean and median.",
  key: "center",
  lessons: 4,
  name: "Describe the center",
};

/** An ENEM band whose skills sit in two of its subjects. */
const SUBJECT_BAND: CourseOutlineParams = {
  ...BAND,
  exams: [{ name: "ENEM", style: "Multiple choice." }],
  requiredSkills: [
    {
      area: "Mathematics",
      description: "Bar and line charts.",
      key: "charts",
      name: "Read charts",
    },
    {
      area: "Languages",
      description: "Words and images together.",
      key: "multimodal",
      name: "Interpret multimodal texts",
    },
  ],
};

const MODEL = "openai/gpt-6-sol";

const usage: LanguageModelUsage = {
  inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1000 },
  inputTokens: 1000,
  outputTokenDetails: { reasoningTokens: 100, textTokens: 400 },
  outputTokens: 500,
  totalTokens: 1500,
};

/** The model's answer, as `generateText` returns it. */
function answer(output: unknown) {
  const step = {
    model: { modelId: MODEL, provider: "gateway" },
    providerMetadata: {},
    response: { modelId: MODEL },
    usage,
  };

  return { finalStep: step, output, steps: [step], usage };
}

/** A chapter whose lessons teach these skills, one lesson per list. */
function outlineChapter({
  lessonSkills,
  skillKeys,
  title,
}: {
  lessonSkills: string[][];
  skillKeys: string[];
  title: string;
}) {
  return {
    description: `About ${title}.`,
    lessons: lessonSkills.map((skills, index) => ({
      canDo: "Read a chart",
      description: "One idea.",
      estimatedMinutes: 3,
      skills,
      title: `${title} ${index + 1}`,
    })),
    objectives: ["Read a chart"],
    skillKeys,
    title,
    tools: [],
  };
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The inputs the instructions refer to, such as `REQUIRED_SKILLS`. */
function findMentionedInputs(instructions: string): string[] {
  return [...new Set(instructions.match(/`[A-Z][A-Z_]+`/gu))].map((name) =>
    name.replaceAll("`", ""),
  );
}

function isSent({ name, prompt }: { name: string; prompt: string }): boolean {
  return prompt.includes(`${name}:`) || prompt.includes(`name="${name}"`);
}

/** What the outline's one call read; the model never answers, since only the prompt matters here. */
async function sendOutline(params: CourseOutlineParams) {
  vi.mocked(generateText).mockRejectedValue(new Error("Only the prompt is checked"));
  await expect(generateCourseOutline(params)).rejects.toThrow("Only the prompt is checked");

  const [call] = vi.mocked(generateText).mock.calls.map(([options]) => options);
  return { instructions: toText(call?.instructions), prompt: toText(call?.prompt) };
}

describe(generateCourseOutline, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it.each<[string, CourseOutlineParams]>([
    ["a shared band", BAND],
    [
      "an exam's band",
      { ...BAND, exams: [{ name: "SAT", style: "Multiple choice." }], withoutTools: true },
    ],
    ["a learner's private course", { ...BAND, material: "[p1] Mean and median." }],
    ["a skill's next chapter", { ...BAND, extendSkills: [EXTEND_SKILL] }],
    ["an exam's band whose skills sit in its subjects", SUBJECT_BAND],
  ])("sends %s every input its instructions mention and no other variant's", async (_, params) => {
    const { instructions, prompt } = await sendOutline(params);
    const mentioned = findMentionedInputs(instructions);

    expect(mentioned.filter((name) => !isSent({ name, prompt }))).toStrictEqual([]);

    for (const name of ["WITHOUT_TOOLS", "EXAMS", "EXTEND_SKILLS", "MATERIAL"]) {
      expect(isSent({ name, prompt })).toBe(mentioned.includes(name));
    }

    expect(instructions).not.toContain("{{");
  });

  it("leaves the exam, material and continuing rules out of a shared band's outline", async () => {
    const { instructions, prompt } = await sendOutline(BAND);

    expect(instructions).not.toMatch(
      /# Skills an exam needs|# The learner's own material|# Continuing a skill/u,
    );

    expect(prompt).not.toMatch(/WITHOUT_TOOLS|EXAMS|EXTEND_SKILLS/u);
  });

  it("gives an exam's band the rules for teaching its skills the way the exam asks them", async () => {
    const { instructions, prompt } = await sendOutline({
      ...BAND,
      exams: [{ name: "SAT", style: "Multiple choice." }],
    });

    expect(instructions).toContain("When `EXAMS` names the exam");
    expect(instructions).not.toContain("When `WITHOUT_TOOLS` is `yes`");
    expect(prompt).toContain("EXAMS:\n- SAT: Multiple choice.");
    expect(prompt).not.toContain("WITHOUT_TOOLS");
  });

  it("writes an outline again, told which chapters mix subjects, when its lessons don't say how to split them", async () => {
    const mixed = outlineChapter({
      lessonSkills: [["Read infographics"], ["Compare map colors"]],
      skillKeys: ["charts", "multimodal"],
      title: "Visual panels",
    });

    const apart = [
      outlineChapter({
        lessonSkills: [["Read infographics"]],
        skillKeys: ["charts"],
        title: "Charts",
      }),
      outlineChapter({
        lessonSkills: [["Relate text and image"]],
        skillKeys: ["multimodal"],
        title: "Multimodal texts",
      }),
    ];

    vi.mocked(generateText)
      .mockResolvedValueOnce(answer({ chapters: [mixed] }) as never)
      .mockResolvedValueOnce(answer({ chapters: apart }) as never);

    const outline = await generateCourseOutline(SUBJECT_BAND);

    const [first, second] = vi
      .mocked(generateText)
      .mock.calls.map(([options]) => ({
        instructions: toText(options.instructions),
        prompt: toText(options.prompt),
      }));

    expect(first?.prompt).toContain("- charts [Mathematics]: Read charts. Bar and line charts.");
    expect(first?.instructions).toContain("never tag skills of two areas on one chapter");
    expect(`${first?.instructions}${first?.prompt}`).not.toContain("MIXED_AREA_CHAPTERS");

    expect(second?.prompt).toContain(
      'MIXED_AREA_CHAPTERS: \n- "Visual panels" mixes Mathematics, Languages',
    );

    expect(second?.instructions).toContain("`MIXED_AREA_CHAPTERS` lists chapters");

    expect(outline.data.chapters.map((chapter) => chapter.title)).toStrictEqual([
      "Charts",
      "Multimodal texts",
    ]);

    expect(outline.setAside).toStrictEqual([{ model: MODEL, usage }]);
  });

  it("splits a chapter that mixes subjects in code, without another call, when its lessons name them", async () => {
    const mixed = outlineChapter({
      lessonSkills: [["Read charts"], ["Interpret multimodal texts"]],
      skillKeys: ["charts", "multimodal"],
      title: "Visual panels",
    });

    vi.mocked(generateText).mockResolvedValue(answer({ chapters: [mixed] }) as never);

    const outline = await generateCourseOutline(SUBJECT_BAND);

    expect(generateText).toHaveBeenCalledOnce();

    expect(
      outline.data.chapters.map((chapter) => [chapter.title, chapter.skillKeys]),
    ).toStrictEqual([
      ["Visual panels", ["charts"]],
      ["Visual panels 2", ["multimodal"]],
    ]);

    expect(outline.setAside).toStrictEqual([]);
  });
});
