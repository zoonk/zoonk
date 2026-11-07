import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

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
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Explique a forma a × 10ⁿ, com a de 1 até menos de 10: conte quantas casas a vírgula anda e para que lado. Mostre 203.000.000 = 2,03 × 10⁸ e 0,0000075 = 7,5 × 10⁻⁶.",
      kind: "explanation",
      skills: [0],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo: escreva a distância da Terra à Lua, 384.400 km, como 3,844 × 10⁵ km; depois a espessura de uma folha de papel, 0,00045 m, como 4,5 × 10⁻⁴ m.",
      kind: "workedExample",
      skills: [0],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Peça que escreva 0,0062 em notação científica: 6,2 × 10⁻³. Inclua 62 × 10⁻⁴ (o decimal não fica entre 1 e 10) e 6,2 × 10³ (sinal do expoente trocado) como erros tentadores.",
      kind: "check",
      skills: [0],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Para multiplicar, multiplique os decimais e some os expoentes; se o decimal passar de 10, ajuste a potência. Mostre (3,5 × 10⁴) × (2,4 × 10³) = 8,4 × 10⁷.",
      kind: "explanation",
      skills: [1],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo: uma bactéria mede 2,5 × 10⁻⁶ m; quantas cabem enfileiradas em 1,5 × 10⁻² m? Divida os decimais (1,5 ÷ 2,5 = 0,6), subtraia os expoentes (−2 − (−6) = 4) e ajuste: 0,6 × 10⁴ = 6 × 10³, ou 6.000 bactérias.",
      kind: "workedExample",
      skills: [1],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Peça que calcule (4,0 × 10⁵) × (2,5 × 10⁻²): 1,0 × 10⁴. Inclua 10 × 10³ (decimal não ajustado) e 1,0 × 10⁻¹⁰ (expoentes multiplicados em vez de somados) como erros tentadores.",
      kind: "check",
      skills: [1],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Um texto de prova diz que o Sol fica a 1,496 × 10⁸ km da Terra e a Lua a 3,844 × 10⁵ km. Peça que estime quantas vezes o Sol está mais longe: cerca de 389 vezes (1,496 ÷ 3,844 ≈ 0,389 e 10⁸ ÷ 10⁵ = 10³).",
      kind: "application",
      skills: [0, 1],
      visual: null,
      visualKind: "none",
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
  title: "Notação científica",
} satisfies LessonSpec;

export const RECORDED_POWERS_OF_TEN_SPEC = {
  canDo: "Multiplicar e dividir números em notação científica",
  description:
    "Mostra como combinar as potências de dez ao multiplicar ou dividir medidas escritas em notação científica.",
  estimatedMinutes: 4,
  screens: [
    {
      activityTemplate: null,
      brief:
        "Um detector registra 10³ sinais por segundo durante 10² segundos. Quantos sinais ele registra: 10⁵, 10⁶ ou 10¹? Mostre 10⁵ assim que você escolher; a explicação vem depois.",
      kind: "hook",
      skills: [],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: "formulaModel",
      brief:
        "Mostre que 10² × 10³ reúne cinco fatores iguais a 10, dando 10⁵. No modelo 10² × 10ⁿ, deixe você variar n de −2 a 3 e observar tanto o expoente 2 + n quanto o valor do produto: ao multiplicar potências de dez, somam-se os expoentes.",
      kind: "explanation",
      skills: [0],
      visual: null,
      visualKind: "template",
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo (3 × 10⁴) × (2 × 10⁻²): multiplique 3 por 2 e some 4 com −2, chegando a 6 × 10². Destaque que o sinal negativo faz parte do expoente que entra na soma.",
      kind: "workedExample",
      skills: [0],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: "formulaModel",
      brief:
        "Você ajusta n no modelo (4 × 10³) × (2 × 10ⁿ), com n de −2 a 1, e responde quanto vale o produto quando n = −1. A resposta é 8 × 10²; inclua 8 × 10⁴ como erro tentador de ignorar o sinal negativo.",
      kind: "activity",
      skills: [0],
      visual: null,
      visualKind: "template",
    },
    {
      activityTemplate: "formulaModel",
      brief:
        "Mostre que, em 10⁵ ÷ 10², dois fatores iguais a 10 se cancelam e restam 10³: ao dividir, subtrai-se o expoente do divisor. No modelo 10³ ÷ 10ⁿ, deixe n variar de −2 a 2 e mostre o expoente 3 − n e o valor do quociente.",
      kind: "explanation",
      skills: [1],
      visual: null,
      visualKind: "template",
    },
    {
      activityTemplate: null,
      brief:
        "Resolva passo a passo (8 × 10⁴) ÷ (2 × 10⁻²): divida 8 por 2 e calcule 4 − (−2), chegando a 4 × 10⁶. Mostre por que subtrair um expoente negativo aumenta o expoente do resultado.",
      kind: "workedExample",
      skills: [1],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Peça que você calcule (6 × 10³) ÷ (2 × 10⁻¹) com menos ajuda. A resposta é 3 × 10⁴; inclua 3 × 10² como erro tentador de somar os expoentes na divisão.",
      kind: "check",
      skills: [1],
      visual: null,
      visualKind: "none",
    },
    {
      activityTemplate: null,
      brief:
        "Em uma medição de luz, um detector registra 2 × 10⁴ sinais por segundo durante 3 × 10⁻² segundo. Se os sinais forem repartidos igualmente em 2 × 10¹ blocos de análise, quantos sinais haverá por bloco? Peça que você escolha os dados relevantes, multiplique para obter 6 × 10² sinais e depois divida para chegar a 3 × 10¹ sinais por bloco.",
      kind: "application",
      skills: [0, 1],
      visual: null,
      visualKind: "none",
    },
  ],
  skills: [
    {
      description:
        "Ao multiplicar números em notação científica, multiplicam-se os números iniciais e somam-se os expoentes de dez.",
      example: "(3 × 10⁴) × (2 × 10⁻²) = 6 × 10².",
      hard: true,
      name: "Multiplicar números em notação científica",
      topic: "Operações em notação científica",
      useCase:
        "Calcular uma quantidade total a partir de uma taxa e de um intervalo de tempo em um experimento.",
    },
    {
      description:
        "Ao dividir números em notação científica, dividem-se os números iniciais e subtrai-se o expoente do divisor.",
      example: "(8 × 10⁴) ÷ (2 × 10⁻²) = 4 × 10⁶.",
      hard: true,
      name: "Dividir números em notação científica",
      topic: "Operações em notação científica",
      useCase: "Calcular uma quantidade por grupo ou uma taxa a partir de medidas de laboratório.",
    },
  ],
  title: "Multiplicando e dividindo potências de dez",
} satisfies LessonSpec;
