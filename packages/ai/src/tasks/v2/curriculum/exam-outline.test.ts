import { describe, expect, it } from "vitest";
import {
  type ExamOutline,
  findUncoveredTopics,
  formatExamOutline,
  placeInExam,
} from "./exam-outline";

const outline: ExamOutline = {
  name: "Concurso da Câmara dos Deputados",
  notes: ["Scoring: um item errado anula um item certo"],
  subjects: [
    {
      group: "Conhecimentos básicos (P1)",
      name: "Língua Portuguesa",
      questions: null,
      topics: [
        "3 Domínio da ortografia",
        "5 Domínio da estrutura morfossintática do período",
        "5.5 Concordância verbal e nominal",
        "5.7 Emprego do sinal indicativo de crase",
      ],
      weight: null,
    },
    {
      group: "Conhecimentos específicos (P2)",
      name: "Ciência Política",
      questions: 20,
      topics: ["Regimes políticos"],
      weight: 0.1,
    },
  ],
  topicFrequency: [{ level: "high", subject: "Língua Portuguesa", topic: "Crase" }],
};

describe(formatExamOutline, () => {
  it("numbers subjects and topics so skills can cite them by id", () => {
    expect(formatExamOutline(outline)).toBe(
      [
        "EXAM: Concurso da Câmara dos Deputados",
        "NOTES:\n- Scoring: um item errado anula um item certo",
        [
          "SUBJECTS:",
          "S1. Língua Portuguesa (Conhecimentos básicos (P1))",
          "  S1.1 3 Domínio da ortografia",
          "  S1.2 5 Domínio da estrutura morfossintática do período",
          "  S1.3 5.5 Concordância verbal e nominal",
          "  S1.4 5.7 Emprego do sinal indicativo de crase",
          "S2. Ciência Política (Conhecimentos específicos (P2); 20 questions; weight 10%)",
          "  S2.1 Regimes políticos",
        ].join("\n"),
        "TOPIC_FREQUENCY:\n- Língua Portuguesa / Crase: high",
      ].join("\n\n"),
    );
  });

  it("says which subjects are options of a choice candidates take only one of", () => {
    const choice = {
      name: "ENEM",
      notes: [],
      subjects: [
        {
          choiceGroup: "Língua Estrangeira",
          group: null,
          name: "Língua Espanhola",
          questions: 5,
          topics: [],
          weight: null,
        },
      ],
      topicFrequency: [],
    };

    expect(formatExamOutline(choice)).toContain(
      'S1. Língua Espanhola (an option of "Língua Estrangeira": each candidate takes only one option; 5 questions)',
    );
  });
});

describe(findUncoveredTopics, () => {
  it("lists the topics no skill of their subject teaches, an item with sub-items through them", () => {
    const uncovered = findUncoveredTopics({
      outline,
      skills: [
        { area: "Língua Portuguesa", topics: ["5.7 Emprego do sinal indicativo de crase"] },
        // A skill of another subject doesn't cover a topic that happens to share the words.
        { area: "Ciência Política", topics: ["3 Domínio da ortografia"] },
      ],
    });

    expect(uncovered).toStrictEqual([
      { subject: "Língua Portuguesa", topic: "3 Domínio da ortografia" },
      { subject: "Língua Portuguesa", topic: "5.5 Concordância verbal e nominal" },
      { subject: "Ciência Política", topic: "Regimes políticos" },
    ]);
  });
});

const OAB: ExamOutline = {
  name: "Exame de Ordem",
  notes: [],
  subjects: [
    {
      group: null,
      name: "Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB",
      questions: 8,
      shortName: "Ética Profissional",
      topics: [],
      weight: null,
    },
    {
      group: null,
      name: "Direito Tributário e Processual Tributário",
      questions: 5,
      shortName: "Direito Tributário",
      topics: [],
      weight: null,
    },
  ],
  topicFrequency: [],
};

describe(placeInExam, () => {
  // Sofia's graph called the notice's ethics subject by its short name, and her plan showed the
  // heaviest subject of the exam as outside the plan.
  it("places an area named as learners call a subject in that subject", () => {
    expect(placeInExam({ area: "Ética Profissional", outline: OAB, topics: [] })).toStrictEqual({
      area: OAB.subjects[0]?.name,
      topics: [],
    });

    expect(placeInExam({ area: "Direito Tributário", outline: OAB, topics: [] })).toStrictEqual({
      area: "Direito Tributário e Processual Tributário",
      topics: [],
    });
  });

  // DELE B2's notice is in Spanish; a graph written for a Portuguese speaker spelled one subject in
  // Portuguese, which then read as outside the notice.
  it("places an area written in another language's spelling of a subject in that subject", () => {
    const dele: ExamOutline = {
      name: "DELE B2",
      notes: [],
      subjects: ["Expresión e interacción escritas", "Expresión e interacción orales"].map(
        (name) => ({ group: null, name, questions: null, topics: [], weight: null }),
      ),
      topicFrequency: [],
    };

    expect(
      placeInExam({ area: "Expressão e interação escritas", outline: dele, topics: [] }),
    ).toStrictEqual({ area: "Expresión e interacción escritas", topics: [] });
  });

  it("keeps an area the notice has no subject for", () => {
    expect(placeInExam({ area: "Estratégia de prova", outline: OAB, topics: [] })).toStrictEqual({
      area: "Estratégia de prova",
      topics: [],
    });
  });
});
