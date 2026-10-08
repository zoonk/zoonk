import { describe, expect, it } from "vitest";
import { type ExamOutline, findUncoveredTopics, formatExamOutline } from "./exam-outline";

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
