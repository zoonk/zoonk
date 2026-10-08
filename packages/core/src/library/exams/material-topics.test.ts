import { describe, expect, it } from "vitest";
import { type BlueprintContent } from "./blueprint-contract";
import { toMaterialContent } from "./material-topics";

const CITATION = { passage: "BIOLOGIA - 1º ANO B", sourceId: "notes" };

const PEDRO_ANNOUNCEMENT =
  "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

/** Pedro's class notes as he pasted them in persona pass 7. */
const PEDRO_NOTES = `BIOLOGIA - 1º ANO B - Prof.ª Juliana
Resumo pra prova de sábado (10/10): A CÉLULA

1) Teoria celular
- Todo ser vivo é formado por células (exceto vírus!)
- A célula é a menor unidade da vida
- Toda célula vem de outra célula (Virchow)
- Hooke viu as "celas" na cortiça (1665)

2) Procarionte x eucarionte
- Procarionte: sem núcleo (DNA solto no citoplasma = nucleoide), sem organelas membranosas. Ex: bactérias
- Eucarionte: núcleo com carioteca + organelas. Ex: animais, plantas, fungos, protozoários
- As duas têm: membrana plasmática, citoplasma, ribossomos, DNA

3) Membrana plasmática
- Bicamada de fosfolipídios + proteínas (mosaico fluido)
- Permeabilidade seletiva
- Transporte passivo (sem gasto de ATP): difusão simples, difusão facilitada, osmose
- Osmose: água vai do meio hipotônico (menos concentrado) para o hipertônico (mais concentrado)
- Hemácia em água pura incha e estoura (hemólise); em solução muito salgada murcha
- Transporte ativo: gasta ATP, contra o gradiente. Ex: bomba de sódio e potássio
- Endocitose (fagocitose e pinocitose) e exocitose

4) Organelas (CAI MUITO!!)
- Mitocôndria: respiração celular, produz ATP
- Cloroplasto: fotossíntese (só em plantas e algas)
- Ribossomos: síntese de proteínas
- RE rugoso: tem ribossomos, faz proteínas / RE liso: lipídios, desintoxicação
- Complexo golgiense: modifica, empacota e secreta
- Lisossomo: digestão intracelular
- Vacúolo: grande na célula vegetal
- Parede celular: célula vegetal (celulose)

5) Núcleo
- Carioteca (envoltório nuclear com poros)
- Cromatina = DNA + proteínas
- Nucléolo: produz ribossomos

6) Vírus
- Acelulares, só se reproduzem dentro de células (parasitas intracelulares obrigatórios)
- Capsídeo de proteína + material genético (DNA ou RNA)
- Antibiótico NÃO funciona contra vírus

${PEDRO_ANNOUNCEMENT}`;

function content(topics: string[]): BlueprintContent {
  return {
    edition: {
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: null,
      sourceHash: "hash",
      timeZone: null,
      year: null,
    },
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        {
          citation: CITATION,
          group: null,
          name: "Biologia",
          questions: null,
          shortName: null,
          topics,
          weight: null,
        },
      ],
    },
    topicFrequency: [],
  };
}

/** The topics and the stressed ones a reading of these headings stores. */
function readHeadings(headings: string[]) {
  const cleaned = toMaterialContent({
    content: content(headings),
    documents: [{ sourceId: "notes", text: headings.join("\n") }],
  });

  return {
    stressed: cleaned.topicFrequency.map((entry) => [entry.topic, entry.basis]),
    topics: cleaned.structure.subjects[0]?.topics,
  };
}

describe("a reading of the learner's own material", () => {
  it("drops a heading's numbering and keeps its words", () => {
    expect(
      readHeadings([
        "1) Teoria celular",
        "2. Procarionte x eucarionte",
        "3.1 Osmose",
        "b) Vírus",
        "IV - Núcleo",
        "• Membrana plasmática",
      ]).topics,
    ).toStrictEqual([
      "Teoria celular",
      "Procarionte x eucarionte",
      "Osmose",
      "Vírus",
      "Núcleo",
      "Membrana plasmática",
    ]);
  });

  it("reads the learner's own remark that a topic matters as emphasis, out of its name", () => {
    expect(
      readHeadings(["4) Organelas (CAI MUITO!!)", "Osmose - IMPORTANTE", "Mitose!!!"]),
    ).toStrictEqual({
      stressed: [
        ["Organelas", "CAI MUITO!!"],
        ["Osmose", "IMPORTANTE"],
        ["Mitose", "!!!"],
      ],
      topics: ["Organelas", "Osmose", "Mitose"],
    });
  });

  it("keeps what a heading says about its content, and a name that is only a number", () => {
    const headings = [
      "Organelas (mitocôndria e cloroplasto)",
      "DNA e RNA",
      "Retículo endoplasmático (RE)",
      "Civil - contratos",
      "1)",
    ];

    expect(readHeadings(headings)).toStrictEqual({ stressed: [], topics: headings });
  });
});

describe(toMaterialContent, () => {
  it("cleans every topic of the learner's material and marks the ones they said come up a lot", () => {
    const cleaned = toMaterialContent({
      content: content(["1) Teoria celular", "4) Organelas (CAI MUITO!!)", "5) Núcleo"]),
      documents: [{ sourceId: "notes", text: "...\n4) Organelas (CAI MUITO!!)\n- Mitocôndria" }],
    });

    expect(cleaned.structure.subjects[0]?.topics).toStrictEqual([
      "Teoria celular",
      "Organelas",
      "Núcleo",
    ]);

    expect(cleaned.topicFrequency).toStrictEqual([
      {
        appearances: null,
        basis: "CAI MUITO!!",
        citation: { passage: "4) Organelas (CAI MUITO!!)", sourceId: "notes" },
        level: "high",
        subject: "Biologia",
        topic: "Organelas",
      },
    ]);
  });

  // Both reads of Pedro's notes quoted the teacher's sentence for the table and dropped the essay.
  it("keeps every question format the teacher's announcement names", () => {
    const passage =
      "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

    const table = {
      citation: { passage, sourceId: "notes" },
      description: "Questão de preenchimento de tabela das organelas.",
      kind: "other" as const,
      options: null,
    };

    const read = content(["Organelas"]);

    const cleaned = toMaterialContent({
      content: { ...read, structure: { ...read.structure, formats: [table] } },
      documents: [{ sourceId: "notes", text: passage }],
    });

    expect(cleaned.structure.formats).toStrictEqual([
      table,
      {
        citation: { passage, sourceId: "notes" },
        description: "Dissertativa sobre osmose",
        kind: "essay",
        options: null,
      },
    ]);
  });

  // Pass 7: both reads of Pedro's notes, or the check of their claims, left no format at all, so
  // his practice had no table to fill in and no essay on osmosis.
  it("reads the formats the learner's notes announce when the reading kept none", () => {
    const read = content([
      "1) Teoria celular",
      "2) Procarionte x eucarionte",
      "3) Membrana plasmática",
      "4) Organelas (CAI MUITO!!)",
      "5) Núcleo",
      "6) Vírus",
    ]);

    const cleaned = toMaterialContent({
      content: read,
      documents: [{ sourceId: "notes", text: PEDRO_NOTES }],
    });

    const citation = { passage: PEDRO_ANNOUNCEMENT, sourceId: "notes" };

    expect(cleaned.structure.formats).toStrictEqual([
      { citation, description: "Completar a tabela das organelas", kind: "shortAnswer", options: null },
      { citation, description: "Dissertativa sobre osmose", kind: "essay", options: null },
    ]);

    expect(cleaned.topicFrequency.map((entry) => [entry.topic, entry.basis])).toStrictEqual([
      ["Organelas", "CAI MUITO!!"],
      ["Membrana plasmática", "Dissertativa sobre osmose"],
    ]);
  });

  it("reads no format from a topic that names one without announcing a question", () => {
    const notes = [
      "PORTUGUÊS - Prova de quinta",
      "1) Concordância verbal",
      "2) Redação dissertativa-argumentativa: tese, argumentos e conclusão",
    ].join("\n");

    const cleaned = toMaterialContent({
      content: content(["1) Concordância verbal", "2) Redação dissertativa-argumentativa"]),
      documents: [{ sourceId: "notes", text: notes }],
    });

    expect(cleaned.structure.formats).toStrictEqual([]);
  });

  it("adds nothing a format quoting another passage of the announcement already asks", () => {
    const sentence =
      "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

    const formats = [
      {
        citation: { passage: sentence, sourceId: "notes" },
        description: "Questão discursiva sobre osmose.",
        kind: "essay" as const,
        options: null,
      },
      {
        citation: { passage: sentence.slice(14), sourceId: "notes" },
        description: "Questão de completar a tabela das organelas.",
        kind: "shortAnswer" as const,
        options: null,
      },
    ];

    const read = content(["Organelas"]);

    const cleaned = toMaterialContent({
      content: { ...read, structure: { ...read.structure, formats } },
      documents: [{ sourceId: "notes", text: sentence }],
    });

    expect(cleaned.structure.formats).toStrictEqual(formats);
  });

  it("renames what the reading already said about a topic instead of adding it twice", () => {
    const read = content(["4) Organelas (CAI MUITO!!)"]);

    const cleaned = toMaterialContent({
      content: {
        ...read,
        topicFrequency: [
          {
            appearances: null,
            basis: "a professora disse que cai muito",
            citation: { passage: "4) Organelas (CAI MUITO!!)", sourceId: "notes" },
            level: "high",
            subject: "Biologia",
            topic: "4) Organelas (CAI MUITO!!)",
          },
        ],
      },
      documents: [{ sourceId: "notes", text: "4) Organelas (CAI MUITO!!)" }],
    });

    expect(cleaned.topicFrequency).toStrictEqual([
      {
        appearances: null,
        basis: "a professora disse que cai muito",
        citation: { passage: "4) Organelas (CAI MUITO!!)", sourceId: "notes" },
        level: "high",
        subject: "Biologia",
        topic: "Organelas",
      },
    ]);
  });

  // Pedro's teacher announced an essay on osmosis, which his notes cover under "Membrana
  // plasmática": at 30 minutes a day his plan cut that topic first.
  describe("the topics the test announces a question about", () => {
    const NOTES = [
      "BIOLOGIA - 1º ANO B",
      "2) Procarionte x eucarionte",
      "- Eucarionte: núcleo com carioteca + organelas",
      "3) Membrana plasmática",
      "- Transporte passivo: difusão simples, difusão facilitada, osmose",
      "- Osmose: água vai do meio hipotônico para o hipertônico",
      "4) Organelas (CAI MUITO!!)",
      "- Mitocôndria: respiração celular",
      "6) Vírus",
      "- Acelulares",
    ];

    const ANNOUNCEMENT =
      "A prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!";

    function announced(descriptions: string[]) {
      const read = content([
        "2) Procarionte x eucarionte",
        "3) Membrana plasmática",
        "4) Organelas (CAI MUITO!!)",
        "6) Vírus",
      ]);

      const formats = descriptions.map((description) => ({
        citation: { passage: ANNOUNCEMENT, sourceId: "notes" },
        description,
        kind: "essay" as const,
        options: null,
      }));

      const cleaned = toMaterialContent({
        content: { ...read, structure: { ...read.structure, formats } },
        documents: [{ sourceId: "notes", text: [...NOTES, ANNOUNCEMENT].join("\n") }],
      });

      return cleaned.topicFrequency.map((entry) => [entry.topic, entry.level, entry.basis]);
    }

    it("marks the topic whose part of the material holds what the question is about", () => {
      expect(announced(["Dissertativa sobre osmose"])).toStrictEqual([
        ["Organelas", "high", "CAI MUITO!!"],
        ["Membrana plasmática", "high", "Dissertativa sobre osmose"],
      ]);
    });

    it("marks a topic the announcement names, once, whatever else stresses it", () => {
      expect(announced(["Questão de completar a tabela das organelas"])).toStrictEqual([
        ["Organelas", "high", "CAI MUITO!!"],
      ]);

      expect(announced(["Questão sobre vírus"])).toStrictEqual([
        ["Organelas", "high", "CAI MUITO!!"],
        ["Vírus", "high", "Questão sobre vírus"],
      ]);
    });

    it("marks nothing when the question's words are in several topics or in none", () => {
      // Diffusion is under the membrane and the mitochondrion under the organelles; genetics is
      // nowhere in the notes.
      expect(
        announced(["Dissertativa sobre difusão e mitocôndria", "Questão de genética"]),
      ).toStrictEqual([["Organelas", "high", "CAI MUITO!!"]]);
    });
  });
});
