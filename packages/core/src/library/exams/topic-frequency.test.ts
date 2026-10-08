import { describe, expect, it } from "vitest";
import { type ExamStructure, type TopicFrequency } from "./blueprint-contract";
import { getTopicFrequencySource, listTopicLevels, needsTopicFrequency } from "./topic-frequency";

const citation = { passage: "…", sourceId: "notice" };
const NOW = new Date("2026-10-07T12:00:00.000Z");

const NATUREZA = "Ciências da Natureza e suas Tecnologias";
const HUMANAS = "Ciências Humanas e suas Tecnologias";

function subject(name: string, shortName: string, topics: string[]) {
  return { citation, group: null, name, questions: 45, shortName, topics, weight: null };
}

/** ENEM's objective areas as its notice lists their contents, two of them. */
const enem: ExamStructure = {
  formats: [{ citation, description: "Cinco opções", kind: "multipleChoice", options: 5 }],
  mock: null,
  rules: [],
  subjects: [
    subject(NATUREZA, "Ciências da Natureza", [
      "Moléculas, células e tecidos",
      "Hereditariedade e diversidade da vida",
      "Ecologia e ciências ambientais",
      "A Mecânica e o funcionamento do Universo",
    ]),
    subject(HUMANAS, "Ciências Humanas", [
      "Diversidade cultural, conflitos e vida em sociedade",
      "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
      "Características e transformações das estruturas produtivas",
      "Representação espacial",
    ]),
  ],
};

/** A reading of past papers names the area by its short name and the topic by its usual name. */
const papers: TopicFrequency = [
  {
    appearances: null,
    basis: "O tema de Biologia mais cobrado.",
    citation,
    level: "high",
    subject: "Ciências da Natureza",
    topic: "Ecologia",
  },
  {
    appearances: null,
    basis: "Presença regular em Física.",
    citation,
    level: "medium",
    subject: "Ciências da Natureza",
    topic: "Eletricidade",
  },
];

const looked: ExamStructure = {
  ...enem,
  pastTopicFrequency: {
    checkedAt: "2026-10-07T10:00:00.000Z",
    subjects: [
      {
        basis: "questões de 2009 a 2024",
        name: NATUREZA,
        source: { title: "Assuntos que mais caem", url: "https://example.com/enem-natureza" },
        topics: [
          { appearances: 40, level: "high", topic: "Hereditariedade e diversidade da vida" },
          { appearances: 8, level: "low", topic: "A Mecânica e o funcionamento do Universo" },
          { appearances: 70, level: "medium", topic: "Ecologia e ciências ambientais" },
        ],
      },
    ],
  },
};

/** ENEM after a lookup that found no source for any subject. */
function lookedUpEmpty(checkedAt: string): ExamStructure {
  return { ...enem, pastTopicFrequency: { checkedAt, subjects: [] } };
}

describe(listTopicLevels, () => {
  it("puts what past papers say on the notice's own topics, and leaves out what matches none", () => {
    expect(listTopicLevels({ structure: enem, topicFrequency: papers })).toStrictEqual([
      { level: "high", subject: NATUREZA, topic: "Ecologia e ciências ambientais" },
    ]);
  });

  it("puts a topic's usual name on the notice topic that words it otherwise, only when one does", () => {
    const physicsAndChemistry: ExamStructure = {
      ...enem,
      subjects: [
        subject(NATUREZA, "Ciências da Natureza", [
          "Fenômenos Elétricos e Magnéticos",
          "O calor e os fenômenos térmicos",
          "Transformações Químicas",
          "Energias Químicas no Cotidiano",
          "Compostos de Carbono",
        ]),
      ],
    };

    const usualNames = ["Eletricidade", "Química orgânica", "Fenômenos"].map((topic) => ({
      ...papers[0],
      level: "high" as const,
      topic,
    }));

    expect(
      listTopicLevels({
        structure: physicsAndChemistry,
        topicFrequency: usualNames as TopicFrequency,
      }),
    ).toStrictEqual([
      { level: "high", subject: NATUREZA, topic: "Fenômenos Elétricos e Magnéticos" },
    ]);
  });

  it("fills the topics past papers don't rate from the lookup, past papers first", () => {
    expect(listTopicLevels({ structure: looked, topicFrequency: papers })).toStrictEqual([
      { level: "high", subject: NATUREZA, topic: "Ecologia e ciências ambientais" },
      { level: "high", subject: NATUREZA, topic: "Hereditariedade e diversidade da vida" },
      { level: "low", subject: NATUREZA, topic: "A Mecânica e o funcionamento do Universo" },
    ]);
  });
});

describe(needsTopicFrequency, () => {
  it("looks a subject's topics up once, when past papers rate few of them", () => {
    expect(needsTopicFrequency({ now: NOW, structure: enem, topicFrequency: papers })).toBe(true);
    expect(needsTopicFrequency({ now: NOW, structure: looked, topicFrequency: [] })).toBe(false);
  });

  it("tries again a month later for the subjects a lookup didn't find", () => {
    const later = new Date("2026-11-20T12:00:00.000Z");

    // Natureza is rated; Humanas isn't, so a month on it's looked up again.
    expect(needsTopicFrequency({ now: later, structure: looked, topicFrequency: [] })).toBe(true);
  });

  it("tries again a month after a lookup that found nothing", () => {
    const recent = lookedUpEmpty("2026-09-20T00:00:00.000Z");
    const old = lookedUpEmpty("2026-08-20T00:00:00.000Z");

    expect(needsTopicFrequency({ now: NOW, structure: recent, topicFrequency: [] })).toBe(false);
    expect(needsTopicFrequency({ now: NOW, structure: old, topicFrequency: [] })).toBe(true);
  });

  it("leaves subjects with a few topics alone", () => {
    const small: ExamStructure = {
      ...enem,
      subjects: [subject("Redação", "Redação", ["Texto dissertativo-argumentativo"])],
    };

    expect(needsTopicFrequency({ now: NOW, structure: small, topicFrequency: [] })).toBe(false);
  });
});

describe(getTopicFrequencySource, () => {
  it("says where a subject's topic frequency came from, and nothing for a subject without one", () => {
    const [natureza, humanas] = looked.subjects;

    expect(
      getTopicFrequencySource({ structure: looked, subject: natureza ?? { name: "" } }),
    ).toStrictEqual({
      basis: "questões de 2009 a 2024",
      title: "Assuntos que mais caem",
      url: "https://example.com/enem-natureza",
    });

    expect(
      getTopicFrequencySource({ structure: looked, subject: humanas ?? { name: "" } }),
    ).toBeNull();
  });
});
