import { describe, expect, it } from "vitest";
import { toTopicFrequencyFinding } from "./topic-frequency-finding";

const PAGE = "https://blog.example.com/enem-assuntos-que-mais-caem";
const searched = (url: string) => url.startsWith("https://blog.example.com/");

const subjects = [
  {
    name: "Ciências da Natureza e suas Tecnologias",
    topics: [
      "Moléculas, células e tecidos",
      "Hereditariedade e diversidade da vida",
      "A Mecânica e o funcionamento do Universo",
    ],
  },
  {
    name: "Ciências Humanas e suas Tecnologias",
    topics: ["Diversidade cultural, conflitos e vida em sociedade", "Representação espacial"],
  },
];

const natureza = {
  basis: " questões de 2009 a 2024 ",
  sourceTitle: "Os assuntos que mais caem no Enem",
  sourceUrl: PAGE,
  subject: 1,
  topics: [
    { appearances: 41, level: "high", topic: "S1.2" },
    { appearances: 6, level: "low", topic: " S1.3 " },
  ],
};

describe(toTopicFrequencyFinding, () => {
  it("keeps a subject's topics one source rates, in the notice's words, with the source", () => {
    expect(
      toTopicFrequencyFinding({ isSearched: searched, raw: { subjects: [natureza] }, subjects }),
    ).toStrictEqual({
      subjects: [
        {
          basis: "questões de 2009 a 2024",
          name: "Ciências da Natureza e suas Tecnologias",
          source: { title: "Os assuntos que mais caem no Enem", url: PAGE },
          topics: [
            { appearances: 41, level: "high", topic: "Hereditariedade e diversidade da vida" },
            { appearances: 6, level: "low", topic: "A Mecânica e o funcionamento do Universo" },
          ],
        },
      ],
    });
  });

  it("leaves out invented pages, other subjects' topics, unknown ids and a second source", () => {
    const raw = {
      subjects: [
        { ...natureza, sourceUrl: "https://invented.example.org/page" },
        {
          ...natureza,
          subject: 2,
          topics: [
            { appearances: null, level: "high", topic: "S1.1" },
            { appearances: -3, level: "medium", topic: "S2.2" },
            { appearances: null, level: "high", topic: "S2.9" },
          ],
        },
        { ...natureza, subject: 2, topics: [{ appearances: 9, level: "high", topic: "S2.1" }] },
        { ...natureza, subject: 7 },
      ],
    };

    expect(toTopicFrequencyFinding({ isSearched: searched, raw, subjects })).toStrictEqual({
      subjects: [
        {
          basis: "questões de 2009 a 2024",
          name: "Ciências Humanas e suas Tecnologias",
          source: { title: "Os assuntos que mais caem no Enem", url: PAGE },
          topics: [{ appearances: null, level: "medium", topic: "Representação espacial" }],
        },
      ],
    });
  });
});
