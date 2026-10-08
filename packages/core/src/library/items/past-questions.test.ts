import { randomUUID } from "node:crypto";
import { type PastQuestion } from "@zoonk/ai/tasks/v2/items/past-questions";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { parseItemContent } from "./item-content";
import { type PastPaperTarget, listPastQuestionPapers, savePastQuestions } from "./past-questions";

const PAPER_TEXT = `QUESTÃO 91
Um celular custava R$ 1.000,00 e teve dois aumentos seguidos de 10%.
Qual é o novo preço do celular?
A R$ 1.200,00
B R$ 1.210,00
C R$ 1.100,00
D R$ 1.020,00
E R$ 1.201,00`;

const ENEM_STRUCTURE = {
  formats: [
    {
      citation: { passage: "Cada questão tem cinco alternativas.", sourceId: "notice" },
      description: "Múltipla escolha com cinco alternativas",
      kind: "multipleChoice",
      options: 5,
    },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

function topicFrequency(paperIds: string[]) {
  return paperIds.map((sourceId) => ({
    appearances: 3,
    basis: "3 de 45 questões",
    citation: { passage: "Porcentagem aparece em quase todas as provas.", sourceId },
    level: "high",
    subject: "Matemática",
    topic: "Porcentagem",
  }));
}

/** An exam goal whose blueprint read its topic frequency from `papers`, with one skill planned. */
async function examGoal({
  language = "pt",
  noticePublisher = "Inep",
  papers,
}: {
  language?: string;
  noticePublisher?: string;
  papers: { id: string }[];
}) {
  const [user, skill, notice] = await Promise.all([
    userFixture(),
    skillFixture({ language, name: "Aumentos percentuais sucessivos" }),
    sourceFixture({ language, publisher: noticePublisher }),
  ]);

  const blueprint = await examBlueprintFixture({
    language,
    name: "Enem",
    sourceId: notice.id,
    structure: ENEM_STRUCTURE,
    topicFrequency: topicFrequency(papers.map((paper) => paper.id)),
  });

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    language,
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: { skills: [{ lessons: 1, name: skill.name, phase: 0, skillId: skill.id }] },
  });

  return { blueprint, goal, skill };
}

function paperFixture(attrs: Parameters<typeof sourceFixture>[0] = {}) {
  return sourceFixture({
    extractedText: PAPER_TEXT,
    language: "pt",
    publisher: "Inep",
    title: `Enem 2023, caderno azul ${randomUUID().slice(0, 4)}`,
    url: `https://download.inep.gov.br/enem/${randomUUID()}.pdf`,
    ...attrs,
  });
}

function copiedQuestion(overrides: Partial<PastQuestion> = {}): PastQuestion {
  const options = ["R$ 1.200,00", "R$ 1.210,00", "R$ 1.100,00", "R$ 1.020,00", "R$ 1.201,00"];

  return {
    citation: "Enem 2023, 2º dia, questão 91",
    item: {
      context: "Um celular custava R$ 1.000,00 e teve dois aumentos seguidos de 10%.",
      difficulty: "easy",
      format: "multipleChoice",
      image: null,
      options: options.map((text) => ({
        isCorrect: text === "R$ 1.210,00",
        misconception: text === "R$ 1.210,00" ? null : "Soma os aumentos",
        reason: "Motivo.",
        text,
      })),
      question: "Qual é o novo preço do celular?",
      visual: null,
    },
    number: "91",
    skill: 1,
    ...overrides,
  };
}

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  model: "google/gemini-3.8-flash",
  promptVersion: "test",
  runId: "past-questions-test",
};

describe(listPastQuestionPapers, () => {
  it("lists an exam's allowed past papers in the learner's language, with its skills", async () => {
    const paper = await paperFixture();
    const { blueprint, goal, skill } = await examGoal({ papers: [paper] });

    await expect(listPastQuestionPapers({ goalId: goal.id })).resolves.toStrictEqual([
      {
        exam: "Enem",
        examBlueprintId: blueprint.id,
        format: "multipleChoice",
        language: "pt",
        optionCount: 5,
        paper: { id: paper.id, title: paper.title },
        skills: [{ description: skill.description, id: skill.id, name: skill.name }],
      },
    ]);
  });

  it("keeps original questions only where reuse isn't allowed or is unclear", async () => {
    const [collegeBoard, unknownBoard, forbidden, english] = await Promise.all([
      paperFixture({
        publisher: "College Board",
        url: "https://satsuite.collegeboard.org/test.pdf",
      }),
      paperFixture({ publisher: "Some prep site", url: "https://prep.example.test/paper.pdf" }),
      paperFixture({
        reusePolicy: {
          basis: "Terms",
          honorTakedowns: true,
          pastQuestions: "notAllowed",
          termsUrl: null,
        },
      }),
      paperFixture({ language: "en" }),
    ]);

    const goals = await Promise.all([
      examGoal({ papers: [collegeBoard, unknownBoard, forbidden, english] }),
      examGoal({ noticePublisher: "College Board", papers: [await paperFixture()] }),
    ]);

    const lists = await Promise.all(
      goals.map(({ goal }) => listPastQuestionPapers({ goalId: goal.id })),
    );

    expect(lists).toStrictEqual([[], []]);
  });
});

/** An allowed paper, listed for a new exam goal, ready to import. */
async function listedPaper(): Promise<PastPaperTarget> {
  const paper = await paperFixture();
  const { goal } = await examGoal({ papers: [paper] });
  const [listed] = await listPastQuestionPapers({ goalId: goal.id });

  if (!listed) {
    throw new Error("Expected the paper to be listed");
  }

  return listed;
}

describe(savePastQuestions, () => {
  it("stores copied questions as quoted, in the paper's option order, citing the paper once", async () => {
    const paper = await listedPaper();
    const reworded = copiedQuestion({ citation: "Enem 2023, questão 92", number: "92" });

    const changed = {
      ...reworded,
      item: { ...copiedQuestion().item, question: "Quanto custa agora?" },
    };

    const result = await savePastQuestions({
      paperText: PAPER_TEXT,
      provenance: PROVENANCE,
      questions: [copiedQuestion(), changed],
      target: paper,
    });

    expect(result).toStrictEqual({
      created: 1,
      rejected: [{ number: "92", problems: ["The command isn't in the paper as printed."] }],
    });

    const [item] = await prisma.item.findMany({ where: { sourceId: paper.paper.id } });

    expect(item).toMatchObject({
      examBlueprintId: paper.examBlueprintId,
      skillId: paper.skills[0]?.id,
      sourceCitation: "Enem 2023, 2º dia, questão 91",
    });

    const stored = item ? parseItemContent(item) : null;

    // The paper's order, A to E, not shuffled like written questions.
    expect(stored?.content).toMatchObject({
      options: ["R$ 1.200,00", "R$ 1.210,00", "R$ 1.100,00", "R$ 1.020,00", "R$ 1.201,00"].map(
        (text) => ({ text }),
      ),
      quoted: true,
    });

    const again = await savePastQuestions({
      paperText: PAPER_TEXT,
      provenance: { ...PROVENANCE, runId: "second-run" },
      questions: [copiedQuestion()],
      target: paper,
    });

    expect(again.created).toBe(0);
  });

  it("leaves an imported paper off the list for the next learner of the exam", async () => {
    const paper = await paperFixture();
    const { blueprint, goal, skill } = await examGoal({ papers: [paper] });

    await itemFixture({ examBlueprintId: blueprint.id, skillId: skill.id, sourceId: paper.id });

    await expect(listPastQuestionPapers({ goalId: goal.id })).resolves.toStrictEqual([]);
  });
});
