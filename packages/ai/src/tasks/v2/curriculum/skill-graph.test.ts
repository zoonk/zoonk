import { type LanguageModelUsage, generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { type ExamOutline } from "./exam-outline";
import { generateSkillGraph } from "./skill-graph";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./skill-graph.prompt.md", () => ({ default: "Write the skill graph." }));

// Every part of a graph is a paid model call; the test answers them to check how the graph is put
// together.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
}));

const MODEL = "openai/gpt-6-sol";

const usage: LanguageModelUsage = {
  inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1000 },
  inputTokens: 1000,
  outputTokenDetails: { reasoningTokens: 100, textTokens: 400 },
  outputTokens: 500,
  totalTokens: 1500,
};

const SUBJECTS = ["Português", "Constitucional", "Processo legislativo", "Administrativo"];

/** A notice with four subjects of one topic each: S1.1 is Português's, S2.1 the constitution's. */
const NOTICE: ExamOutline = {
  name: "Concurso",
  notes: [],
  subjects: SUBJECTS.map((name) => ({
    group: null,
    name,
    questions: null,
    topics: [`Tópico de ${name}`],
    weight: null,
  })),
  topicFrequency: [],
};

function answer(output: unknown) {
  const step = {
    model: { modelId: MODEL, provider: "gateway" },
    providerMetadata: {},
    response: { modelId: MODEL },
  };

  return { finalStep: step, output, steps: [step], usage };
}

const FRAME = {
  courses: [{ key: "concurso", levels: ["intermediate"], title: "Concurso" }],
  phases: [
    { milestone: "Ler e interpretar", title: "Fundamentos" },
    { milestone: "Aplicar as regras", title: "Aplicação" },
  ],
  sections: SUBJECTS.map((area, index) => ({
    area,
    course: "concurso",
    estimatedLessons: 40,
    phases: [index < 2 ? 1 : 2],
    skills: 2,
    subject: `S${index + 1}`,
  })),
};

/** One skill for each subject a skills call writes; processo legislativo builds on S2.1. */
function writeSections(prompt: string) {
  const subjects = SUBJECTS.map((name, index) => ({ id: `S${index + 1}`, name })).filter(
    (subject) => new RegExp(`- ${subject.id} `, "u").test(prompt.split("WRITE:")[1] ?? ""),
  );

  return {
    skills: subjects.map((subject) => ({
      area: subject.name,
      course: "concurso",
      description: `Entender ${subject.name}`,
      estimatedLessons: 20,
      examWeight: 3,
      key: "base",
      level: "intermediate",
      name: `Entender ${subject.name}`,
      outcome: false,
      phase: subject.id === "S3" || subject.id === "S4" ? 2 : 1,
      prerequisites: subject.id === "S3" ? ["S2.1"] : [],
      topics: [`${subject.id}.1`],
    })),
  };
}

describe(generateSkillGraph, () => {
  it("writes a big exam's frame first, then its subjects at once, and joins them into one graph", async () => {
    const prompts: string[] = [];

    vi.mocked(generateText).mockImplementation(async ({ prompt }) => {
      const text = typeof prompt === "string" ? prompt : "";
      prompts.push(text);

      return (
        text.includes("SECTION: frame") ? answer(FRAME) : answer(writeSections(text))
      ) as never;
    });

    const { data, provenance } = await generateSkillGraph({
      examBlueprint: NOTICE,
      goal: "Passar no concurso",
      goalKind: "exam",
      language: "pt",
    });

    // The frame, then one call per subject: four subjects, each with the frame to follow.
    expect(prompts).toHaveLength(5);
    expect(prompts[0]).toContain("SECTION: frame");
    expect(prompts.slice(1).every((text) => text.includes("FRAME:"))).toBe(true);

    expect(data.skills.map((skill) => [skill.area, skill.topics, skill.phase])).toStrictEqual([
      ["Português", ["Tópico de Português"], 1],
      ["Constitucional", ["Tópico de Constitucional"], 1],
      ["Processo legislativo", ["Tópico de Processo legislativo"], 2],
      ["Administrativo", ["Tópico de Administrativo"], 2],
    ]);

    // Every call named its skill "base": the keys stay apart, and the legislative process builds
    // on the skill that teaches the constitution's topic.
    const constitution = data.skills.find((skill) => skill.area === "Constitucional");
    const process = data.skills.find((skill) => skill.area === "Processo legislativo");

    expect(new Set(data.skills.map((skill) => skill.key)).size).toBe(4);
    expect(process?.prerequisites).toStrictEqual([constitution?.key]);

    // One provenance for the whole graph, with every call's usage.
    expect(provenance.usage.outputTokens).toBe(2500);
  });

  it("writes any other goal's graph whole, in one call", async () => {
    vi.mocked(generateText).mockReset();

    vi.mocked(generateText).mockResolvedValue(
      answer({
        courses: FRAME.courses,
        phases: FRAME.phases,
        skills: writeSections("WRITE:\n- S1 Português").skills,
      }) as never,
    );

    const { data } = await generateSkillGraph({
      goal: "Entender juros compostos",
      goalKind: "learn",
      language: "pt",
      purpose: "overview",
    });

    expect(generateText).toHaveBeenCalledOnce();
    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).toContain("SECTION: whole");
    expect(data.skills).toHaveLength(1);
  });
});
