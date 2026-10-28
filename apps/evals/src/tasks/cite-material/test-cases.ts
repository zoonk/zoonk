import { type TestCase } from "@/lib/types";
import { type CiteMaterialInput } from "@zoonk/ai/tasks/v2/material/cite";
import {
  CELL_NOTES,
  CONSTITUTION_ARTICLES,
  GLYCOLYSIS_SLIDES,
  IRS_PAGES,
  MARKET_NOTES,
} from "./material-fixtures";

export type CiteMaterialExpected = { refs: string[][] };

export const TEST_CASES: TestCase<CiteMaterialExpected, CiteMaterialInput>[] = [
  {
    expected: { refs: [["S1:1", "none"], ["S1:1"], ["S2:1"], ["S1:1"], ["S2:1", "none"]] },
    id: "en-tax-deadlines-official",
    userInput: {
      documents: "sources",
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
      documents: "sources",
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
      documents: "material",
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
      documents: "material",
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
      documents: "material",
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
  {
    expected: {
      refs: [
        ["S1:1", "none"],
        ["S1:1"],
        ["S1:1", "none"],
        ["S1:1"],
        ["S1:1", "none"],
        ["S1:1", "none"],
        ["S1:1"],
        ["S1:1", "none"],
        [],
      ],
    },
    id: "pt-osmosis-notes",
    userInput: {
      documents: "material",
      material: CELL_NOTES,
      screens: [
        "Fábio separa dois lados com uma membrana que deixa passar apenas água. O lado A tem 20 g/L de sal e o lado B tem 5 g/L. Para onde a água migra preferencialmente? A água se desloca do lado B para o lado A, fluindo espontaneamente para a região com maior concentração de sal. Esta aula mostra o motivo desse movimento. Do lado B para o lado A Do lado A para o lado B Nenhum movimento de água ocorre",
        "Tonicidade e comparação de meios A **tonicidade** sempre compara a quantidade de soluto dissolvido entre dois compartimentos. O meio com menor concentração de soluto é chamado de **hipotônico**. Já o lado com maior concentração é o **hipertônico**. Quando ambos possuem a mesma concentração, são chamados de **isotônicos**.",
        "Cíntia analisa duas soluções em laboratório separadas por uma barreira: Amostra 1: 5% de glicose; Amostra 2: 12%. Como a Amostra 1 é classificada em relação à Amostra 2? A Amostra 1 tem menor porcentagem de soluto (5%) do que a Amostra 2 (12%), sendo portanto hipotônica em relação a ela. Hipotônica Hipertônica Isotônica",
        "A regra geral da osmose A **osmose** é a passagem de água através de uma membrana semipermeável sem gasto de energia da célula (sem consumo de ATP). Como o soluto não consegue atravessar a barreira, a água se desloca do meio hipotônico em direção ao hipertônico. Esse fluxo age para diluir o lado mais concentrado até reduzir a diferença entre eles.",
        "Fluxo osmótico no tubo em U Um tubo em U contém o braço esquerdo com 10 g/L de sacarose e o braço direito com 40 g/L de sacarose, separados por uma membrana semipermeável. Para onde a água flui? O braço esquerdo é hipotônico e o direito é hipertônico: a água flui do hipotônico para o hipertônico, elevando o nível do braço direito.",
        "Igor monta um recipiente com os compartimentos X (0,3 mol/L de sacarose) e Y (0,9 mol/L) separados por membrana semipermeável. O que ocorre com o fluxo de água e o volume em Y? A água flui de X para Y, aumentando o volume de líquido em Y A sacarose migra de Y para X A água flui de Y para X",
        "Em duas ou três frases, explique por que a água se desloca em direção ao meio hipertônico durante a osmose. Como a membrana semipermeável impede a passagem do soluto, o equilíbrio só pode ser buscado pela movimentação da água. Trata-se de um transporte passivo, sem gasto de ATP, em que a água migra para o meio hipertônico para diluí-lo.",
        "Em sua cozinha, Priscila prepara conservas de pepino em uma salmoura com 10% de sal. As células do pepino têm cerca de 1% de solutos. Qual é a relação de tonicidade e o que acontece com as fatias? A salmoura é hipertônica e as fatias de pepino desidratam ao perder água",
        "A pressão osmótica de uma solução pode ser calculada pela equação de van 't Hoff: π = iMRT, em que M é a molaridade e T a temperatura absoluta.",
      ],
    },
  },
];
