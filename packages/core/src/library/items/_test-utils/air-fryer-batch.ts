import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

/**
 * The second skill of Terra at high reasoning's pt-enem-mock-quick-only placement batch (8 Nov 2026
 * audit, #2470). The air fryer costs 1,2 kW × 0,5 h × 25 × R$ 0,80 = R$ 12,00, which no option
 * shows, yet it passed every item check; the oven's 26 min 40 s is right.
 */
export const AIR_FRYER_ITEM = {
  context:
    "Iara usa uma fritadeira elétrica de 1.200 W durante 30 minutos por dia, em 25 dias de um mês, em Londrina. Nesse período, a tarifa de energia é de R$ 0,80 por kWh. Considere a potência constante e desconsidere taxas fixas.",
  difficulty: "medium",
  fixedOrder: false,
  format: "multipleChoice",
  image: null,
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason:
        "Você converte 1.200 W em 1,2 kW e 30 minutos em 0,5 hora. O consumo é 1,2 × 0,5 × 25 = 15 kWh, que custam R$ 12,00 à tarifa informada.",
      text: "R$ 9,60",
    },
    {
      isCorrect: false,
      misconception: "Converte minutos em horas como se a hora tivesse 100 minutos",
      reason:
        "Você tratou 30 minutos como 0,3 hora. Como uma hora tem 60 minutos, 30 minutos correspondem a 0,5 hora.",
      text: "R$ 7,20",
    },
    {
      isCorrect: false,
      misconception: "Usa uma hora diária no lugar de meia hora",
      reason: "Você considerou uma hora de uso por dia, mas 30 minutos correspondem a meia hora.",
      text: "R$ 19,20",
    },
    {
      isCorrect: false,
      misconception: "Confunde consumo em kWh com custo em reais",
      reason:
        "Você calculou o consumo de 15 kWh, mas o apresentou como custo em reais sem multiplicá-lo pela tarifa.",
      text: "R$ 15,00",
    },
    {
      isCorrect: false,
      misconception: "Usa watts no lugar de quilowatts",
      reason:
        "Você usou 1.200 W como se fossem 1.200 kW. Para obter quilowatts, divida a potência em watts por 1.000.",
      text: "R$ 12.000,00",
    },
  ],
  question: "Qual é o custo da energia consumida pela fritadeira nesse período?",
  visual: null,
} satisfies ItemOf<"multipleChoice">;

export const OVEN_ITEM = {
  context:
    "Otávio programa um forno elétrico de potência constante de 1.500 W para funcionar todos os dias de um mês de 30 dias, sempre pelo mesmo tempo, em Ribeirão Preto. A energia custa R$ 0,90 por kWh, e ele quer limitar o custo mensal desse aparelho a R$ 18,00. Desconsidere taxas fixas.",
  difficulty: "hard",
  fixedOrder: false,
  format: "multipleChoice",
  image: null,
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason:
        "Com R$ 18,00, você pode consumir 20 kWh. Dividindo esse consumo por 1,5 kW e por 30 dias, obtém 4/9 de hora por dia, ou 26 minutos e 40 segundos.",
      text: "26 minutos e 40 segundos",
    },
    {
      isCorrect: false,
      misconception: "Confunde o orçamento em reais com o consumo em kWh",
      reason:
        "Você tratou R$ 18,00 como se correspondessem a 18 kWh. É preciso dividir o valor pela tarifa de R$ 0,90 por kWh antes de calcular o tempo.",
      text: "24 minutos",
    },
    {
      isCorrect: false,
      misconception: "Multiplica o orçamento pela tarifa em vez de dividir",
      reason:
        "Você multiplicou R$ 18,00 por 0,90 para obter o consumo permitido. Como a tarifa é o custo de cada kWh, você deve dividir o orçamento pela tarifa.",
      text: "21 minutos e 36 segundos",
    },
    {
      isCorrect: false,
      misconception: "Trata o consumo diário em kWh como tempo em horas",
      reason:
        "Você calculou o consumo diário permitido, mas o interpretou como tempo, sem considerar que o forno consome 1,5 kWh a cada hora.",
      text: "40 minutos",
    },
    {
      isCorrect: false,
      misconception: "Lê a parte decimal da hora como minutos",
      reason:
        "Você aproximou o tempo diário de 0,44 hora, mas interpretou a parte decimal como minutos. Para converter horas em minutos, multiplique por 60.",
      text: "44 minutos",
    },
  ],
  question: "Qual é o tempo máximo de funcionamento diário para atender a esse limite?",
  visual: null,
} satisfies ItemOf<"multipleChoice">;

export const AIR_FRYER_EXAM = { language: "pt", optionCount: 5 } as const;
