import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { linkGoalToExamBlueprint, toResearchPlanInput } from "./exam-learners";

const DETAILS = {
  examName: "OAB 1ª fase",
  examTarget: "pass",
  followUps: [{ answer: "No escritório do meu tio, em Pelotas", question: "Onde você trabalha?" }],
  level: "basic",
  reason: "Quero sair do emprego na loja da Maria",
  role: "Estagiária",
};

const GOAL = {
  details: DETAILS,
  kind: "exam" as const,
  prompt: "Sou a Sofia, estagiária em Pelotas, e quero passar na OAB em março",
  title: "Passar na OAB",
  uploadIds: [],
};

describe(toResearchPlanInput, () => {
  // The plan names the exam every learner of it shares: its identity, sources and searches.
  it("reads the exam the goal names, never the learner's own words", () => {
    const input = toResearchPlanInput(GOAL);

    expect(input).toStrictEqual({
      details: '{"examName":"OAB 1ª fase"}',
      goal: "OAB 1ª fase",
      personal: false,
    });

    expect(JSON.stringify(input)).not.toMatch(/Sofia|Pelotas|Maria|Estagiária|escritório/u);
  });

  it("reads what identifies an exam (its name, its role in the notice, its edition), never the learner's target", () => {
    const enem = toResearchPlanInput({
      ...GOAL,
      details: {
        examName: "ENEM",
        examTarget: "admission",
        examYear: 2027,
        institution: "UFMG",
        targetCourse: "Medicina",
        targetScore: "750",
      },
      prompt: "quero tirar 750 no enem pra passar em medicina na ufmg",
      title: "Passar no ENEM com 750 em Medicina",
    });

    expect(enem).toStrictEqual({
      details: '{"examName":"ENEM","examYear":2027}',
      goal: "ENEM",
      personal: false,
    });

    // A public-service exam's notice has a part for each position: the position is which exam.
    const camara = toResearchPlanInput({
      ...GOAL,
      details: {
        examName: "concurso da Câmara dos Deputados",
        targetPosition: "Analista Legislativo, área de Registro e Redação",
      },
      title: "Passar no concurso da Câmara dos Deputados",
    });

    expect(camara.goal).toBe(
      "concurso da Câmara dos Deputados, Analista Legislativo, área de Registro e Redação",
    );
  });

  it("keeps what the learner wrote for a goal from their own material", () => {
    const uploaded = toResearchPlanInput({ ...GOAL, uploadIds: ["upload"] });

    const classTest = toResearchPlanInput({
      ...GOAL,
      details: { ...DETAILS, materialIntent: "exam" },
    });

    expect(uploaded.goal).toBe(`Passar na OAB\n${GOAL.prompt}`);
    expect(uploaded.details).toContain("Estagiária");
    expect(classTest.goal).toContain("Sofia");
    expect([uploaded.personal, classTest.personal]).toStrictEqual([true, true]);
  });
});

describe(linkGoalToExamBlueprint, () => {
  it("gives an exam goal the language its exam's notice says it tests, and keeps it without one", async () => {
    const user = await userFixture();

    const testedLanguage = {
      citation: {
        passage: "PTE Academic is a computer-based academic English test.",
        sourceId: "s",
      },
      language: "en",
    };

    const [pte, other, goal, unread] = await Promise.all([
      examBlueprintFixture({
        name: "PTE Academic",
        structure: { formats: [], mock: null, rules: [], subjects: [], testedLanguage },
      }),
      examBlueprintFixture(),
      goalFixture({ kind: "exam", title: "PTE Academic 65", userId: user.id }),
      goalFixture({ kind: "exam", targetLanguage: "es", title: "DELE B2", userId: user.id }),
    ]);

    await Promise.all([
      linkGoalToExamBlueprint({ examBlueprintId: pte.id, goalId: goal.id }),
      linkGoalToExamBlueprint({ examBlueprintId: other.id, goalId: unread.id }),
    ]);

    const goals = await prisma.goal.findMany({ where: { id: { in: [goal.id, unread.id] } } });

    expect(
      Object.fromEntries(
        goals.map((row) => [row.title, [row.examBlueprintId, row.targetLanguage]]),
      ),
    ).toStrictEqual({ "DELE B2": [other.id, "es"], "PTE Academic 65": [pte.id, "en"] });
  });
});
