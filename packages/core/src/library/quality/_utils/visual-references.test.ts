import { describe, expect, it } from "vitest";
import { getVisualProblems, pointsAtFigure } from "./visual-references";

const CHART = {
  axisStart: null,
  categories: ["Maio", "Junho"],
  categoryLabel: "Mês",
  chart: "bar" as const,
  kind: "chart" as const,
  series: [{ name: "Ofícios recebidos", values: [40, 30] }],
  source: null,
  title: "Ofícios por mês",
  unit: null,
  valueLabel: "Ofícios",
};

/** Each kind of visual and a phrase of the problem a screen gets when it points at one unshown. */
const MISSING_PHRASES = [
  ["chart", "of kind chart"],
  ["image", "point at a picture"],
  ["panels", "numbered drawings"],
  ["table", "Markdown"],
  ["timeline", "of kind timeline"],
] as const;

/** The kinds of visual a text points at, read from the problems it gets when nothing is shown. */
function pointedAt(language: string, text: string): string[] {
  const problems = getVisualProblems({
    language,
    shown: { hasImage: false, texts: [text], visual: null },
  });

  return MISSING_PHRASES.filter(([, phrase]) =>
    problems.some((problem) => problem.includes(phrase)),
  ).map(([kind]) => kind);
}

describe("what a screen's words point at", () => {
  it("finds the pictures, tables, charts and timelines a text points the learner at", () => {
    expect(
      pointedAt("pt", "Na imagem, Otávio está parado ao lado de uma bicicleta azul."),
    ).toStrictEqual(["image"]);

    expect(pointedAt("pt", "Na placa da imagem, o Centro fica em frente.")).toStrictEqual([
      "image",
    ]);

    expect(
      pointedAt("pt-BR", "Uma tabela mostra bicicletas disponíveis. No gráfico, a linha sobe."),
    ).toStrictEqual(["chart", "table"]);

    expect(
      pointedAt("en", "Look at the picture. The timeline below shows when each law passed."),
    ).toStrictEqual(["image", "timeline"]);
  });

  it("reads numbered drawings or charts as panels, which only one picture side by side shows", () => {
    expect(pointedAt("pt", "Observe os dois desenhos. Desenho 1: barras deitadas.")).toStrictEqual([
      "panels",
    ]);

    expect(
      pointedAt(
        "pt",
        "Qual gráfico mantém cada contagem? Gráfico 2: visita 6, telefonema 3, mensagem 8.",
      ),
    ).toStrictEqual(["panels"]);

    expect(
      pointedAt(
        "pt",
        "Os dois gráficos mais usados são o de barras e o de linhas. Nos desenhos animados, tudo exagera.",
      ),
    ).toStrictEqual([]);

    expect(pointsAtFigure({ language: "pt", text: "Desenho 2: barras em pé." })).toBe(true);
  });

  it("reads diagrams, maps, schemes and infographics as pictures, since only a picture shows them", () => {
    expect(pointedAt("pt", "No diagrama, a seta vai do coração ao pulmão.")).toStrictEqual([
      "image",
    ]);

    expect(pointedAt("pt", "Observe o mapa: o rio corta a cidade.")).toStrictEqual(["image"]);

    expect(pointedAt("pt", "O esquema abaixo mostra as camadas da Terra.")).toStrictEqual([
      "image",
    ]);

    expect(pointedAt("pt", "No infográfico, cada ícone vale mil pessoas.")).toStrictEqual([
      "image",
    ]);

    expect(
      pointedAt("en", "In the diagram, the arrow points from the heart to the lungs."),
    ).toStrictEqual(["image"]);

    expect(pointedAt("en", "The map below shows the river.")).toStrictEqual(["image"]);
    expect(pointedAt("es", "En el mapa, el río cruza la ciudad.")).toStrictEqual(["image"]);

    expect(
      pointedAt("pt", "O esquema vacinal tem três doses, e o bairro sumiu do mapa."),
    ).toStrictEqual([]);

    expect(pointedAt("en", "The festival put the town on the map.")).toStrictEqual([]);
  });

  it("ignores pictures that are part of a story, figures of speech and the periodic table", () => {
    expect(
      pointedAt(
        "pt",
        "O cartaz traz a foto do prefeito para promover sua imagem. Na figura de linguagem chamada metáfora, na tabela periódica e no quadro da sala…",
      ),
    ).toStrictEqual([]);

    expect(pointsAtFigure({ language: "en", text: "The mayor put his photo on the poster." })).toBe(
      false,
    );
  });
});

describe(getVisualProblems, () => {
  it("asks for the visual a screen points at but doesn't show", () => {
    const problems = getVisualProblems({
      language: "pt",
      shown: {
        hasImage: false,
        texts: [
          "Na imagem 1, Wesley segura um guarda-chuva.",
          "A tabela abaixo mostra os horários.",
        ],
        visual: null,
      },
    });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("`image`");
    expect(problems[1]).toContain("Markdown");
  });

  it("passes a screen that shows what it points at", () => {
    expect(
      getVisualProblems({
        language: "pt",
        shown: {
          hasImage: false,
          texts: [
            "A tabela abaixo mostra os horários.\n\n| Hora | Ônibus |\n|---|---:|\n| 7h | 3 |",
            "No gráfico, junho tem menos.",
          ],
          visual: CHART,
        },
      }),
    ).toStrictEqual([]);
  });

  it("refuses pictures where none can be drawn, uneven charts and ragged tables", () => {
    const problems = getVisualProblems({
      canShowImage: false,
      language: "en",
      shown: {
        hasImage: false,
        texts: ["Look at the photo of the street.\n\n| Hour | Buses |\n|---|---|\n| 7 | 3 | 9 |"],
        visual: { ...CHART, series: [{ name: "Received", values: [40] }] },
      },
    });

    expect(problems).toStrictEqual([
      expect.stringContaining("can't show one"),
      expect.stringContaining("| 7 | 3 | 9 |"),
      expect.stringContaining("has 1 values for 2 categories"),
    ]);
  });

  it("asks for at most two numbered drawings in one picture, or one chart to ask about", () => {
    const shown = {
      hasImage: false,
      texts: ["Qual desenho mostra 3, 6 e 4?", "Desenho 1: 3–4–6", "Desenho 3: 6–3–4"],
      visual: CHART,
    };

    expect(getVisualProblems({ language: "pt", shown })).toStrictEqual([
      expect.stringContaining("never more than two"),
    ]);

    expect(
      getVisualProblems({ language: "pt", shown: { ...shown, hasImage: true, visual: null } }),
    ).toStrictEqual([]);
  });

  it("refuses a chart drawn with characters", () => {
    const problems = getVisualProblems({
      language: "pt",
      shown: {
        hasImage: false,
        texts: ["Exemplo: barras de Marília.\n```\n216 | █\n212 | █\n208 | █ █\n200 +-------\n```"],
        visual: null,
      },
    });

    expect(problems).toStrictEqual([expect.stringContaining("with characters")]);
  });
});
