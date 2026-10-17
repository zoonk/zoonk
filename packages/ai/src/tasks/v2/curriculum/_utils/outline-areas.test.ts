import { describe, expect, it } from "vitest";
import { findMixedAreaChapters, splitMixedAreaChapters } from "./outline-areas";

/** Ana's ENEM skills, by the subject each sits in. */
const skills = [
  { area: "Ciências da Natureza", key: "measures", name: "Interpretar medidas e unidades físicas" },
  { area: "Matemática", key: "chances", name: "Calcular probabilidades simples" },
  { area: "Matemática", key: "charts", name: "Ler gráficos e tabelas" },
  { area: "Linguagens", key: "multimodal", name: "Interpretar textos multimodais" },
  { key: "untagged", name: "Organizar o tempo de prova" },
];

function lesson(title: string, lessonSkills: string[]) {
  return {
    canDo: `Resolver ${title.toLowerCase()}`,
    description: `Sobre ${title.toLowerCase()}.`,
    estimatedMinutes: 3,
    skills: lessonSkills,
    title,
  };
}

/** The 17:51 outline's chapter: measurement lessons, then probability lessons the model named with the math skill. */
const measuresAndChances = {
  description: "Medidas, incertezas e chances.",
  lessons: [
    lesson("Ordem de grandeza", ["Estimar ordens de grandeza"]),
    lesson("Algarismos significativos", ["Interpretar algarismos significativos"]),
    lesson("Resultados equiprováveis", [
      "Reconhecer resultados equiprováveis",
      "Calcular probabilidades simples",
    ]),
    lesson("Espaço amostral em duas etapas", [
      "Contar resultados possíveis",
      "calcular probabilidades simples",
    ]),
  ],
  objectives: ["Estimar ordens de grandeza", "Calcular chances"],
  skillKeys: ["measures", "chances", "untagged"],
  title: "Precisão de medidas e chances em experimentos",
  tools: [],
};

describe(findMixedAreaChapters, () => {
  it("lists chapters tagged with skills of more than one area, with those areas", () => {
    const chapters = [
      measuresAndChances,
      { skillKeys: ["chances", "charts", "untagged"], title: "Chances e gráficos" },
      { skillKeys: ["not-required"], title: "Outra" },
    ];

    expect(findMixedAreaChapters({ chapters, skills })).toStrictEqual([
      {
        areas: ["Ciências da Natureza", "Matemática"],
        title: "Precisão de medidas e chances em experimentos",
      },
    ]);
  });
});

describe(splitMixedAreaChapters, () => {
  it("splits a mixed chapter by the areas its lessons' skills name, the rest going to the area left", () => {
    const split = splitMixedAreaChapters({ chapters: [measuresAndChances], skills });
    const [measures, chances, ...rest] = split;

    expect(rest).toStrictEqual([]);

    expect(measures).toStrictEqual({
      ...measuresAndChances,
      lessons: measuresAndChances.lessons.slice(0, 2),
      skillKeys: ["measures", "untagged"],
    });

    expect(chances).toStrictEqual({
      description: "Sobre resultados equiprováveis.",
      lessons: measuresAndChances.lessons.slice(2),
      objectives: ["Resolver resultados equiprováveis", "Resolver espaço amostral em duas etapas"],
      skillKeys: ["chances"],
      title: "Resultados equiprováveis",
      tools: [],
    });

    expect(findMixedAreaChapters({ chapters: split, skills })).toStrictEqual([]);
  });

  it("keeps only the tags of the one area every lesson teaches", () => {
    const chapter = {
      ...measuresAndChances,
      lessons: measuresAndChances.lessons.slice(2),
      title: "Chances",
    };

    expect(splitMixedAreaChapters({ chapters: [chapter], skills })).toStrictEqual([
      { ...chapter, skillKeys: ["chances", "untagged"] },
    ]);
  });

  it("keeps a mixed chapter whole when its lessons don't say which area each teaches", () => {
    // Ana's 21:08 chapter: graphs, multimodal texts and waves, with no lesson naming a tagged skill.
    const panels = {
      ...measuresAndChances,
      lessons: [
        lesson("Texto e dados em infográficos", ["Interpretar infográficos multimodais"]),
        lesson("Amplitude e comprimento de onda", ["Identificar amplitude de onda"]),
      ],
      skillKeys: ["charts", "multimodal", "measures"],
      title: "Painéis visuais e representações de ondas",
    };

    // A lesson naming skills of two areas can't go to one part either.
    const both = {
      ...measuresAndChances,
      lessons: [
        lesson("Medir chances", [
          "Interpretar medidas e unidades físicas",
          "Calcular probabilidades simples",
        ]),
        lesson("Ordem de grandeza", ["Estimar ordens de grandeza"]),
      ],
    };

    expect(splitMixedAreaChapters({ chapters: [panels, both], skills })).toStrictEqual([
      panels,
      both,
    ]);
  });
});
