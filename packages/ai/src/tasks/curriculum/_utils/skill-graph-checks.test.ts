import { describe, expect, it } from "vitest";
import {
  type CheckedGraphSkill,
  findSkillGraphProblems,
  toSkillNameKey,
} from "./skill-graph-checks";

function skill(overrides: Partial<CheckedGraphSkill> & { key: string }): CheckedGraphSkill {
  return {
    area: "Informática",
    description: `${overrides.key} description`,
    name: `Use skill ${overrides.key}${overrides.key}`,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...overrides,
  };
}

const phases = [{ milestone: "Use the basics", title: "Basics" }];

function codes(skills: CheckedGraphSkill[], exam = true) {
  return findSkillGraphProblems({ exam, phases, skills }).map((problem) => problem.code);
}

function phaseProblems(titles: string[], skills: CheckedGraphSkill[]) {
  return findSkillGraphProblems({
    exam: false,
    phases: titles.map((title) => ({ milestone: "Do it", title })),
    skills,
  }).map(({ code, keys, problem }) => ({ code, keys, problem }));
}

describe(findSkillGraphProblems, () => {
  it("passes a graph with hard dependencies, notice topics first and distinct names", () => {
    expect(
      codes([
        skill({ key: "redes", name: "Explicar redes de computadores", topics: ["1 Redes"] }),
        skill({ key: "internet", prerequisites: ["redes"], topics: ["2 Internet"] }),
        skill({ key: "seguranca", topics: ["3 Segurança"] }),
      ]),
    ).toStrictEqual([]);
  });

  it("finds prerequisite cycles", () => {
    expect(
      codes([skill({ key: "a", prerequisites: ["b"] }), skill({ key: "b", prerequisites: ["a"] })]),
    ).toContain("cycle");
  });

  it("finds a subject chained in textbook order and chains too long to follow", () => {
    const chained = ["a", "b", "c", "d", "e", "f"].map((key, index, keys) =>
      skill({
        area: "Direito Tributário",
        key,
        prerequisites: index === 0 ? [] : [keys[index - 1]!],
        topics: [`${index + 1} Tópico`],
      }),
    );

    expect(codes(chained)).toStrictEqual(["textbookChain"]);

    // A learn goal from zero may build in long chains, but never past the limit.
    expect(codes(chained, false)).toStrictEqual([]);

    const long = Array.from({ length: 14 }, (_, index) =>
      skill({
        area: `Area ${index % 3}`,
        key: `s${index}`,
        prerequisites: index === 0 ? [] : [`s${index - 1}`],
      }),
    );

    expect(codes(long, false)).toStrictEqual(["deepChain"]);
  });

  it("finds a skill beyond the notice that opens a subject the notice lists topics for", () => {
    expect(
      codes([
        skill({ key: "formatos", name: "Distinguir formatos de registros digitais" }),
        skill({ key: "metadados", prerequisites: ["formatos"], topics: ["7.1 Metadados"] }),
        skill({ key: "redes", topics: ["1 Redes"] }),
      ]),
    ).toStrictEqual(["offNoticeFirst"]);
  });

  it("finds skills whose names say the same thing in other words' order or articles", () => {
    expect(
      codes([
        skill({ key: "a", name: "Calcular juros compostos", topics: ["1 Juros"] }),
        skill({ key: "b", name: "Calcular os juros compostos", topics: ["1 Juros"] }),
        skill({
          key: "c",
          name: "Avaliar a validade de negócios jurídicos",
          topics: ["2 Negócios"],
        }),
        skill({ key: "d", name: "Avaliar negócios jurídicos e prazos", topics: ["2 Negócios"] }),
      ]),
    ).toStrictEqual(["nearDuplicate"]);
  });

  it("finds em dashes, placeholders and Markdown in what learners read", () => {
    expect(
      codes([
        skill({ key: "a", name: "Ler gráficos — barras e linhas", topics: ["1 Gráficos"] }),
        skill({ description: "TODO", key: "b", topics: ["2 Tabelas"] }),
        skill({ key: "c", name: "Ler **tabelas", topics: ["3 Tabelas"] }),
      ]),
    ).toStrictEqual(["emDash", "placeholder", "markdown"]);
  });

  it("finds a phase named like another phase, a skill or an area instead of its own stage", () => {
    const skills = [
      skill({ area: "Inglês", key: "aluguel", name: "Alugar um apartamento" }),
      skill({ area: "Inglês", key: "banco", name: "Abrir uma conta no banco", phase: 2 }),
    ];

    expect(phaseProblems(["Chegando ao Canadá", "alugar o Apartamento!"], skills)).toStrictEqual([
      {
        code: "repeatedPhaseName",
        keys: [],
        problem:
          'Phase 2 is titled "alugar o Apartamento!", like the skill "Alugar um apartamento"; title the stage of the path, not something it teaches.',
      },
    ]);

    expect(
      phaseProblems(["Inglês", "Primeiros passos", "Primeiros  passos"], skills),
    ).toStrictEqual([
      {
        code: "repeatedPhaseName",
        keys: [],
        problem:
          'Phase 1 is titled "Inglês", like the area "Inglês"; title the stage of the path, not something it teaches.',
      },
      {
        code: "repeatedPhaseName",
        keys: [],
        problem:
          'Phase 3 is titled "Primeiros  passos", like phase 2; title the stage of the path, not something it teaches.',
      },
    ]);

    expect(phaseProblems(["Chegando ao Canadá", "Vida no dia a dia"], skills)).toStrictEqual([]);
  });

  it("names the skills each problem is about, and none for a problem in the phases", () => {
    const chained = ["a", "b", "c", "d", "e", "f"].map((key, index, keys) =>
      skill({
        area: "Direito Tributário",
        key,
        prerequisites: index === 0 ? [] : [keys[index - 1]!],
        topics: [`${index + 1} Tópico`],
      }),
    );

    const problems = findSkillGraphProblems({
      exam: true,
      phases: [{ milestone: "[Inserir marco]", title: "Base" }],
      skills: [...chained, skill({ description: "TODO", key: "g", topics: ["7 Tópico"] })],
    });

    expect(problems.map(({ code, keys }) => [code, keys])).toStrictEqual([
      ["textbookChain", ["a", "b", "c", "d", "e", "f"]],
      ["placeholder", ["g"]],
      ["placeholder", []],
    ]);

    const long = Array.from({ length: 14 }, (_, index) =>
      skill({ key: `s${index}`, prerequisites: index === 0 ? [] : [`s${index - 1}`] }),
    );

    const [deep] = findSkillGraphProblems({ exam: false, phases, skills: long });

    expect(deep?.keys).toStrictEqual(long.map((item) => item.key).toReversed());
  });
});

describe(toSkillNameKey, () => {
  it("keys a name by its words, without articles, prepositions, case, accents or order", () => {
    expect(toSkillNameKey("Calcular os Juros Compostos.")).toBe(
      toSkillNameKey("calcular juros compostos"),
    );

    expect(toSkillNameKey("Calcular juros simples")).not.toBe(
      toSkillNameKey("Calcular juros compostos"),
    );
  });
});
