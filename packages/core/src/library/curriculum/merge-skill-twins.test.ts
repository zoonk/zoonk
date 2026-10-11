import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { describe, expect, it, vi } from "vitest";
import { mockDecision } from "../identity/_test-utils/identity-mocks";
import { type CurriculumScope } from "./curriculum-scope";
import { mergeGraphSkillTwins } from "./merge-skill-twins";
import { type GoalSkillGraph } from "./save-goal-skills";

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));

type GraphSkill = GoalSkillGraph["skills"][number];

function skill(overrides: Partial<GraphSkill> & { key: string; name: string }): GraphSkill {
  return {
    area: "Língua Portuguesa",
    course: "portugues",
    description: `${overrides.name}.`,
    estimatedLessons: 3,
    examWeight: 3,
    level: "intermediate",
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...overrides,
  };
}

// One graph can write a skill twice in other words, and both would become Library skills.
const graph: GoalSkillGraph = {
  courses: [{ key: "portugues", levels: ["intermediate"], title: "Português" }],
  estimatedHours: 1.2,
  phases: [{ estimatedHours: 1.2, milestone: "Ler e interpretar", title: "Base" }],
  skills: [
    skill({ key: "graficos", name: "Interpretar gráficos e tabelas" }),
    skill({ key: "generos", name: "Distinguir tipos e gêneros textuais" }),
    skill({
      key: "ler",
      name: "Ler e comparar dados em gráficos e tabelas",
      prerequisites: ["generos"],
    }),
    skill({ key: "classificar", name: "Classificar gêneros textuais" }),
  ],
};

const scope: CurriculumScope = {
  generalGoal: "Passar no concurso da Câmara dos Deputados",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

describe(mergeGraphSkillTwins, () => {
  it("asks only about skills that may repeat an earlier one of their area, and merges the twins", async () => {
    const decide = mockDecision("graficos");

    const merged = await mergeGraphSkillTwins({ graph, scope });

    expect(
      decide.mock.calls.map(([call]) => [call.subject.item.title, call.candidates]),
    ).toStrictEqual([
      ["Ler e comparar dados em gráficos e tabelas", [expect.objectContaining({ id: "graficos" })]],
      ["Classificar gêneros textuais", [expect.objectContaining({ id: "generos" })]],
    ]);

    expect(merged.skills.map((item) => [item.key, item.prerequisites])).toStrictEqual([
      ["generos", []],
      ["graficos", ["generos"]],
      ["classificar", []],
    ]);

    expect(merged.estimatedHours).toBe(0.9);
  });

  it("keeps both skills when the decision fails or names a skill it wasn't asked about", async () => {
    vi.mocked(decideLibraryIdentity).mockReset();
    vi.mocked(decideLibraryIdentity).mockRejectedValueOnce(new Error("Jev is down"));

    vi.mocked(decideLibraryIdentity).mockResolvedValueOnce({
      match: { id: "a-library-skill", model: "test/jev", probability: 0.9 },
      verdicts: [],
    });

    const merged = await mergeGraphSkillTwins({ graph, scope });

    expect(merged.skills).toHaveLength(4);
  });

  it("asks only about new skills among new siblings when the rest of the graph is saved", async () => {
    const decide = mockDecision("novo-generos");

    // A notice's reading added the last two skills to a graph whose skills the Library has.
    const added = {
      ...graph,
      skills: [
        ...graph.skills,
        skill({ key: "novo-generos", name: "Reconhecer gêneros textuais pela função" }),
        skill({ key: "novo-tipos", name: "Diferenciar gêneros textuais por sua função" }),
      ],
    };

    vi.mocked(decideLibraryIdentity).mockClear();

    const merged = await mergeGraphSkillTwins({
      graph: added,
      newKeys: ["novo-generos", "novo-tipos"],
      scope,
    });

    expect(
      decide.mock.calls.map(([call]) => [
        call.subject.item.title,
        call.candidates.map((candidate) => candidate.id),
      ]),
    ).toStrictEqual([["Diferenciar gêneros textuais por sua função", ["novo-generos"]]]);

    expect(merged.skills.map((item) => item.key)).not.toContain("novo-tipos");
    expect(merged.skills).toHaveLength(5);
  });

  it("never sends a private graph's skills to the shared decision", async () => {
    vi.mocked(decideLibraryIdentity).mockReset();

    const merged = await mergeGraphSkillTwins({ graph, scope: { ...scope, ownerId: "learner" } });

    expect(merged).toBe(graph);
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });
});
