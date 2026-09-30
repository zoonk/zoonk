import { type TestCase } from "@/lib/types";
import { type CiteMaterialInput } from "@zoonk/ai/tasks/v2/material/cite";
import {
  CONSTITUTION_ARTICLES,
  GLYCOLYSIS_SLIDES,
  IRS_PAGES,
  MARKET_NOTES,
} from "./material-fixtures";

/** For each screen, the references that are right; an empty list means no page supports it. */
export type CiteMaterialExpected = { refs: string[][] };

export const TEST_CASES: TestCase<CiteMaterialExpected, CiteMaterialInput>[] = [
  {
    // Official documents: a screen cites a page only when the page states its fact. The rent
    // comparison's point (paying taxes late costs money) is on the penalties page, or on none.
    expected: { refs: [["S1:1", "none"], ["S1:1"], ["S2:1"], ["S1:1"], ["S2:1", "none"]] },
    id: "en-tax-deadlines-official",
    userInput: {
      material: IRS_PAGES,
      screens: [
        "Guess before we start: if you get more time to file your tax return, do you also get more time to pay?",
        "Your 2025 federal tax return is due April 15, 2026.",
        "Filing late without an extension usually costs 5% of the unpaid tax for each month, up to 25%.",
        "Mia sent Form 4868 on April 10, 2026. By when must she pay what she owes? April 15, 2026 | October 15, 2026 | Whenever she files",
        "Think of your rent: paying it late costs a fee, and taxes work the same way.",
      ],
    },
  },
  {
    expected: { refs: [["S1:1", "none"], ["S2:1"], ["S1:1"], ["S1:1"], []] },
    id: "pt-estabilidade-official",
    userInput: {
      material: CONSTITUTION_ARTICLES,
      screens: [
        "Palpite sem valer ponto: Ana tomou posse num cargo público. Depois de quanto tempo ela pode ficar estável? 2 anos | 3 anos | 5 anos",
        "Para ocupar um cargo efetivo, é preciso passar num concurso público de provas ou de provas e títulos.",
        "O servidor concursado fica estável depois de três anos de efetivo exercício no cargo.",
        "Pedro completou três anos, mas a comissão ainda não fez a avaliação especial de desempenho. Ele já é estável? Sim | Não",
        "Pense no período de experiência de um emprego: a empresa observa o seu trabalho antes de efetivar.",
      ],
    },
  },
  {
    // The opening guess asks about the net yield, so the yield slides support it too.
    expected: {
      refs: [
        ["S1:6", "S1:10", "none"],
        ["S1:5"],
        ["S1:6"],
        ["S1:6", "S1:10"],
        ["S1:3", "S1:10"],
        [],
      ],
    },
    id: "pt-glycolysis-yield",
    userInput: {
      material: GLYCOLYSIS_SLIDES,
      screens: [
        "Você come um pão antes da aula. Quanto ATP sobra de cada glicose na glicólise? Chute: 2 ou 4?",
        "Fase de investimento: a célula gasta 2 ATP para ativar a glicose, como um empréstimo que se paga depois.",
        "Fase de rendimento: a glicólise produz 4 ATP e 2 NADH.",
        "Qual é o saldo de ATP da glicólise por glicose? 2 | 4 | 36",
        "Onde acontece a glicólise? No citoplasma | Na matriz mitocondrial | Nas cristas",
        "Um corredor amador em Recife sente cãibra depois de uma prova longa. Explique o que isso tem a ver com a energia das células.",
      ],
    },
  },
  {
    expected: { refs: [["S1:2"], ["S1:3"], ["S1:3"], []] },
    id: "pt-respiration-stages",
    userInput: {
      material: GLYCOLYSIS_SLIDES,
      screens: [
        "A respiração transforma a energia da glicose em ATP, a moeda de energia da célula.",
        "As três etapas acontecem em lugares diferentes: citoplasma, matriz e cristas. Macete: CMC.",
        "Em que parte da mitocôndria fica a cadeia respiratória? Nas cristas | Na matriz | No citoplasma",
        "Pense numa usina elétrica da sua cidade: ela também transforma um combustível em energia útil.",
      ],
    },
  },
  {
    expected: { refs: [["S1:1"], ["S1:2"], ["S2:4"], ["S2:4"], []] },
    id: "en-supply-demand-notes",
    userInput: {
      material: MARKET_NOTES,
      screens: [
        "When the price of coffee rises, people buy less of it: that's the law of demand.",
        "The market settles where supply meets demand: the equilibrium.",
        "A rent ceiling below the equilibrium price leads to what? A shortage | A surplus | Nothing changes",
        "Minimum wage works as a price floor above equilibrium, so it can create a surplus of workers.",
        "Guess before we start: do airlines charge more on holidays because of demand or because of fuel?",
      ],
    },
  },
];
