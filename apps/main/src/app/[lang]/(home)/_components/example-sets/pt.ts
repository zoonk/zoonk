import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type ExampleSet } from "../example-set";

const languages = { id: "languages", name: "Linguagens e Códigos", share: 0.31 };
const human = { id: "human", name: "Ciências Humanas", share: 0.38 };
const natural = { id: "natural", name: "Ciências da Natureza", share: 0.27 };
const math = { id: "math", name: "Matemática", share: 0.41 };
const essay = { id: "essay", name: "Redação", share: 0.33 };

const republic = {
  id: "republic",
  minutes: 3,
  subject: human,
  title: "A Reação Republicana de 1922",
};

export const pt: ExampleSet = {
  exam: {
    course: { brandSlug: AI_ORG_SLUG, courseSlug: "enem-pt" },
    goal: (month) => `me preparar para o Enem em ${month}`,
    mock: {
      score: "610–690",
      scoreOf: "Ciências da Natureza",
      topics: [
        { id: "ecology", name: "Ecologia", right: 2, total: 4 },
        { id: "electricity", name: "Eletricidade", right: 3, total: 4 },
        { id: "waves", name: "Ondas", right: 3, total: 3 },
        { id: "bonds", name: "Ligações químicas", right: 3, total: 3 },
      ],
    },
    name: "Enem",
    placed: {
      rows: [
        { id: "percentage", state: "skipped", title: "Porcentagem" },
        { id: "chains", state: "skipped", title: "Variações percentuais sucessivas" },
        { id: "offers", lessons: 7, state: "next", title: "Preço final em ofertas com condições" },
        { id: "bulk", lessons: 8, state: "todo", title: "Desconto real em compras em quantidade" },
        { id: "functions", lessons: 2, state: "todo", title: "Funções" },
      ],
      subject: math,
    },
    planName: (month) => `Enem em ${month}`,
    practice: {
      answer:
        "Porque não se trata de quanto eles comem. Todo animal usa a maior parte da energia dos alimentos para se manter vivo, e a respiração libera essa energia como calor. Por isso, só cerca de 10% passa para o próximo nível.",
      ask: "Por que não é a A?",
      context:
        "Em um pasto, o capim é comido por gafanhotos, os gafanhotos por sapos e os sapos por cobras.",
      explanation:
        "A resposta não está na quantidade que eles comem: qualquer animal transforma apenas uma pequena parte do alimento em matéria para seu corpo.",
      options: [
        { result: "wrong", text: "Predadores comem menos que suas presas" },
        {
          result: "right",
          text: "Parte da energia é perdida como calor na respiração de cada organismo",
        },
        { text: "As plantas fazem menos fotossíntese à noite" },
        { text: "Os decompositores consomem a energia primeiro" },
        { text: "A energia se transforma em matéria" },
      ],
      question:
        "Em uma cadeia alimentar, a energia disponível diminui a cada nível trófico. Qual é o principal motivo?",
      subject: natural,
    },
    sittings: ["2026-11-08", "2026-11-15"],
    subjects: [languages, human, natural, math, essay],
    timeZone: "America/Sao_Paulo",
    today: [
      republic,
      { id: "discounts", minutes: 5, subject: math, title: "Cupons e descontos juntos" },
      { essay: true, id: "essay", minutes: 10, subject: essay, title: "Agente e ação" },
    ],
    tomorrow: {
      lessons: [
        { id: "breathing", minutes: 4, subject: natural, title: "Respiração e perda de calor" },
        { id: "text-image", minutes: 5, subject: languages, title: "Texto verbal e imagens" },
        { essay: true, id: "essay", minutes: 8, subject: essay, title: "Meio de execução" },
      ],
      review: { ...republic, id: "review", minutes: 4, title: "Revisão: a Reação Republicana" },
    },
  },
  job: {
    formulas: ["=SOMA(B2:B9)", "=SOMAR(B2:B9)", "=SOMA(B2;B9)"],
    regions: [
      { amount: 42_180, id: "southeast", name: "Sudeste" },
      { amount: 37_920, id: "northeast", name: "Nordeste" },
      { amount: 29_400, id: "south", name: "Sul" },
    ],
    result: "Funcionou. O Sudeste vendeu mais.",
    sql: { orders: "pedidos", region: "regiao", sales: "vendas" },
  },
  move: "london",
};
