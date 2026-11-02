import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { type LanguageModelUsage, generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { type ExamOutline } from "./exam-outline";
import { generateSkillGraph } from "./skill-graph";
import { buildSkillGraphSystemPrompt } from "./skill-graph-system-prompt";
import type * as Ai from "ai";

/** The version an exam's graph records: the exam instructions', however its calls are split. */
const SKILL_GRAPH_PROMPT_VERSION = getPromptVersion({
  systemPrompt: buildSkillGraphSystemPrompt({ goalKind: "exam" }),
});

vi.mock("server-only", () => ({}));

vi.mock("./skill-graph.prompt.md", () => ({
  default: [
    "Write the skill graph.",
    "{{#exam}}\nExam rules.\n{{/exam}}",
    "{{#learn}}\nLearn rules.\n{{/learn}}",
    "{{#language}}\nLanguage rules.\n{{/language}}",
    "{{#material}}\nMaterial rules.\n{{/material}}",
    "{{#budget}}\nBudget rules.\n{{/budget}}",
  ].join("\n"),
}));

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

/** A notice with four subjects of one topic each: S1.1 is Portuguese's, S2.1 the constitution's. */
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
    usage,
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

const WHOLE_GRAPH = {
  courses: FRAME.courses,
  phases: FRAME.phases,
  skills: writeSections("WRITE:\n- S1 Português").skills,
};

function sentPrompts() {
  return vi
    .mocked(generateText)
    .mock.calls.map(([call]) => ({
      instructions: typeof call.instructions === "string" ? call.instructions : "",
      prompt: typeof call.prompt === "string" ? call.prompt : "",
    }));
}

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

    expect(provenance.usage.outputTokens).toBe(2500);

    // Every call reads the same exam instructions, so the calls share a cached prefix, and the graph
    // records the version a later learner of the same notice reuses it by.
    const instructions = new Set(sentPrompts().map((sent) => sent.instructions));
    expect([...instructions]).toStrictEqual(["Write the skill graph.\nExam rules.\n"]);
    expect(provenance.promptVersion).toBe(SKILL_GRAPH_PROMPT_VERSION);
  });

  it("writes any other goal's graph whole, in one call", async () => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue(answer(WHOLE_GRAPH) as never);

    const { data } = await generateSkillGraph({
      goal: "Entender juros compostos",
      goalKind: "learn",
      language: "pt",
      purpose: "overview",
    });

    expect(generateText).toHaveBeenCalledOnce();
    expect(data.skills).toHaveLength(1);
  });

  it("writes the graph once more when code finds it flawed, and keeps the better one", async () => {
    const skills = (chained: boolean) =>
      ["Ler", "Interpretar", "Resumir", "Comparar", "Argumentar", "Revisar"].map((verb, index) => ({
        ...WHOLE_GRAPH.skills[0]!,
        key: `p${index}`,
        name: `${verb} textos`,
        prerequisites: chained && index > 0 ? [`p${index - 1}`] : [],
      }));

    // A subject chained in a textbook's order, then one with hard dependencies only.
    vi.mocked(generateText).mockReset();

    vi.mocked(generateText)
      .mockResolvedValueOnce(answer({ ...WHOLE_GRAPH, skills: skills(true) }) as never)
      .mockResolvedValueOnce(answer({ ...WHOLE_GRAPH, skills: skills(false) }) as never);

    const { data } = await generateSkillGraph({ goal: "ENEM", goalKind: "exam", language: "pt" });

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(data.skills.every((skill) => skill.prerequisites.length === 0)).toBe(true);
  });

  it("writes again only a big exam's flawed section, never the whole graph", async () => {
    const chained = ["Ler", "Interpretar", "Resumir", "Comparar", "Argumentar", "Revisar"].map(
      (verb, index) => ({
        ...writeSections("WRITE:\n- S1 Português").skills[0]!,
        key: `p${index}`,
        name: `${verb} textos`,
        prerequisites: index > 0 ? [`p${index - 1}`] : [],
      }),
    );

    let portugueseCalls = 0;
    vi.mocked(generateText).mockReset();

    // Portuguese comes back chained in a textbook's order the first time, with hard dependencies
    // only the second.
    vi.mocked(generateText).mockImplementation(async ({ prompt }) => {
      const text = typeof prompt === "string" ? prompt : "";

      if (text.includes("SECTION: frame")) {
        return answer(FRAME) as never;
      }

      const written = writeSections(text);

      if (!written.skills.some((skill) => skill.area === "Português")) {
        return answer(written) as never;
      }

      portugueseCalls += 1;

      const skills =
        portugueseCalls === 1 ? chained : chained.map((skill) => ({ ...skill, prerequisites: [] }));

      return answer({ skills: [...written.skills.slice(1), ...skills] }) as never;
    });

    const { data } = await generateSkillGraph({
      examBlueprint: NOTICE,
      goal: "Passar no concurso",
      goalKind: "exam",
      language: "pt",
    });

    // The frame, four sections and Portuguese once more.
    expect(generateText).toHaveBeenCalledTimes(6);
    expect(portugueseCalls).toBe(2);

    const portuguese = data.skills.filter((skill) => skill.area === "Português");

    expect(portuguese).toHaveLength(6);
    expect(portuguese.every((skill) => skill.prerequisites.length === 0)).toBe(true);
  });

  it("keeps a graph whose phase is titled like one of its skills instead of drafting it again", async () => {
    vi.mocked(generateText).mockReset();

    vi.mocked(generateText).mockResolvedValue(
      answer({
        ...WHOLE_GRAPH,
        phases: [{ milestone: "Entender o português", title: "Entender português" }],
      }) as never,
    );

    const { data } = await generateSkillGraph({
      goal: "Entender textos",
      goalKind: "learn",
      language: "pt",
      purpose: "overview",
    });

    expect(generateText).toHaveBeenCalledOnce();
    expect(data.phases.map((phase) => phase.title)).toStrictEqual(["Entender português"]);
  });

  it("repairs em dashes, Markdown and a skill written twice in code, and reports them", async () => {
    const [skill] = WHOLE_GRAPH.skills;

    vi.mocked(generateText).mockReset();

    vi.mocked(generateText).mockResolvedValue(
      answer({
        ...WHOLE_GRAPH,
        skills: [
          { ...skill!, description: "Ler — e entender", key: "a", name: "**Interpretar** textos" },
          { ...skill!, key: "b", name: "Interpretar os textos" },
        ],
      }) as never,
    );

    const { data, repaired } = await generateSkillGraph({
      goal: "Entender textos",
      goalKind: "learn",
      language: "pt",
      purpose: "overview",
    });

    expect(generateText).toHaveBeenCalledOnce();

    expect(data.skills.map((item) => [item.name, item.description])).toStrictEqual([
      ["Interpretar textos", "Ler, e entender"],
    ]);

    expect(new Set(repaired.map((problem) => problem.code))).toStrictEqual(
      new Set(["emDash", "nearDuplicate"]),
    );
  });

  it("gives a learn goal only the learn rules and the inputs they read", async () => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue(answer(WHOLE_GRAPH) as never);

    const { provenance } = await generateSkillGraph({
      goal: "Entender juros compostos",
      goalKind: "learn",
      language: "pt",
      purpose: "overview",
    });

    const [sent] = sentPrompts();

    expect(sent?.instructions).toBe("Write the skill graph.\nLearn rules.\n");
    expect(sent?.prompt).toContain("PURPOSE: overview");

    for (const absent of ["EXAM_BLUEPRINT", "SECTION", "TARGET_LANGUAGE", "LESSON_BUDGET"]) {
      expect(sent?.prompt).not.toContain(absent);
    }

    expect(provenance.promptVersion).not.toBe(SKILL_GRAPH_PROMPT_VERSION);
  });

  it("gives a language goal only the language rules and its target language", async () => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue(answer(WHOLE_GRAPH) as never);

    await generateSkillGraph({
      goal: "Speak English at work",
      goalKind: "language",
      language: "pt",
      targetLanguage: "en",
    });

    const [sent] = sentPrompts();

    expect(sent?.instructions).toBe("Write the skill graph.\nLanguage rules.\n");
    expect(sent?.prompt).toContain("TARGET_LANGUAGE:");
    expect(sent?.prompt).not.toContain("PURPOSE");
    expect(sent?.prompt).not.toContain("SECTION");
  });

  it("writes a small exam's graph whole with the same instructions a big exam's calls read", async () => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue(answer(WHOLE_GRAPH) as never);

    const { provenance } = await generateSkillGraph({
      goal: "ENEM",
      goalKind: "exam",
      language: "pt",
    });

    const [sent] = sentPrompts();

    expect(sent?.instructions).toBe("Write the skill graph.\nExam rules.\n");
    expect(sent?.prompt).toContain("EXAM_BLUEPRINT: none");
    expect(sent?.prompt).toContain("SECTION: whole");
    expect(sent?.prompt).not.toContain("PURPOSE");
    expect(sent?.prompt).not.toContain("LESSON_BUDGET");
    expect(provenance.promptVersion).toBe(SKILL_GRAPH_PROMPT_VERSION);
  });

  it("adds the material and lesson budget rules to a test from the learner's own notes", async () => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue(answer(WHOLE_GRAPH) as never);

    const { provenance } = await generateSkillGraph({
      context: "The learner's own material, page by page: …",
      goal: "Prova de biologia na sexta",
      goalKind: "exam",
      hasMaterial: true,
      language: "pt",
      lessonBudget: 15,
    });

    const [sent] = sentPrompts();

    expect(sent?.instructions).toBe(
      "Write the skill graph.\nExam rules.\nMaterial rules.\nBudget rules.\n",
    );

    expect(sent?.prompt).toContain("LESSON_BUDGET: 15");
    expect(provenance.promptVersion).not.toBe(SKILL_GRAPH_PROMPT_VERSION);
  });
});
