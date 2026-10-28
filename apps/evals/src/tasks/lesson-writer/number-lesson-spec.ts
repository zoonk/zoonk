import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

export const SCIENTIFIC_NOTATION_SPEC = {
  canDo: "Escrever, comparar e multiplicar números em notação científica",
  description:
    "Escreva números muito grandes e muito pequenos como um decimal vezes uma potência de 10 e use essa forma para comparar e calcular.",
  estimatedMinutes: 5,
  screens: [
    {
      activityTemplate: null,
      brief:
        "Mostre dois números escritos por extenso: a população do Brasil, cerca de 203.000.000 pessoas, e o diâmetro de uma hemácia, 0,0000075 m. Peça um palpite sem avaliar: como escrever os dois de um jeito que facilite comparar e calcular?",
      kind: "hook",
      skills: [],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Explique a forma a × 10ⁿ, com a de 1 até menos de 10: conte quantas casas a vírgula anda e para que lado. Mostre 203.000.000 = 2,03 × 10⁸ e 0,0000075 = 7,5 × 10⁻⁶.",
      kind: "explanation",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo: escreva a distância da Terra à Lua, 384.400 km, como 3,844 × 10⁵ km; depois a espessura de uma folha de papel, 0,00045 m, como 4,5 × 10⁻⁴ m.",
      kind: "workedExample",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Peça que escreva 0,0062 em notação científica: 6,2 × 10⁻³. Inclua 62 × 10⁻⁴ (o decimal não fica entre 1 e 10) e 6,2 × 10³ (sinal do expoente trocado) como erros tentadores.",
      kind: "check",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Para multiplicar, multiplique os decimais e some os expoentes; se o decimal passar de 10, ajuste a potência. Mostre (3,5 × 10⁴) × (2,4 × 10³) = 8,4 × 10⁷.",
      kind: "explanation",
      skills: [1],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo: uma bactéria mede 2,5 × 10⁻⁶ m; quantas cabem enfileiradas em 1,5 × 10⁻² m? Divida os decimais (1,5 ÷ 2,5 = 0,6), subtraia os expoentes (−2 − (−6) = 4) e ajuste: 0,6 × 10⁴ = 6 × 10³, ou 6.000 bactérias.",
      kind: "workedExample",
      skills: [1],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Peça que calcule (4,0 × 10⁵) × (2,5 × 10⁻²): 1,0 × 10⁴. Inclua 10 × 10³ (decimal não ajustado) e 1,0 × 10⁻¹⁰ (expoentes multiplicados em vez de somados) como erros tentadores.",
      kind: "check",
      skills: [1],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Um texto de prova diz que o Sol fica a 1,496 × 10⁸ km da Terra e a Lua a 3,844 × 10⁵ km. Peça que estime quantas vezes o Sol está mais longe: cerca de 389 vezes (1,496 ÷ 3,844 ≈ 0,389 e 10⁸ ÷ 10⁵ = 10³).",
      kind: "application",
      skills: [0, 1],
      visual: null,
    },
  ],
  skills: [
    {
      description:
        "Escrever um número como um decimal de 1 até menos de 10 vezes uma potência de 10, contando as casas que a vírgula anda.",
      example: "384.400 km = 3,844 × 10⁵ km e 0,00045 m = 4,5 × 10⁻⁴ m.",
      hard: true,
      name: "Escrever números em notação científica",
      topic: "Notação científica",
      useCase: "Ler distâncias, populações e medidas microscópicas em notícias e provas.",
    },
    {
      description:
        "Multiplicar e dividir números em notação científica operando os decimais e os expoentes, e ajustar o resultado à forma científica.",
      example: "(4,0 × 10⁵) × (2,5 × 10⁻²) = 10 × 10³ = 1,0 × 10⁴.",
      hard: true,
      name: "Calcular com notação científica",
      topic: "Operações em notação científica",
      useCase: "Estimar quantas vezes uma grandeza é maior que outra.",
    },
  ],
  supportMode: "explanationFirst",
  title: "Notação científica",
} satisfies LessonSpec;
