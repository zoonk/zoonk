import { t } from "../../_utils/localize";
import { outlineLesson } from "../content";
import { type SeedChapter } from "../types";
import { foodChainEnergyLesson } from "./lessons/food-chain-energy";
import { percentDiscountLesson } from "./lessons/percent-discount";
import { raiseThenDiscountLesson } from "./lessons/raise-then-discount";

const MATH = t("Math", "Matemática");
const SCIENCES = t("Natural Sciences", "Ciências da Natureza");
const HUMANITIES = t("Humanities", "Ciências Humanas");
const LANGUAGES = t("Languages", "Linguagens");
const ESSAY = t("Essay", "Redação");

/** Math, the area ENEM weighs toward everyday money questions. */
export const enemMathChapters: SeedChapter[] = [
  {
    area: MATH,
    description: t(
      "Discounts, raises and interest: the math ENEM asks in almost every edition.",
      "Descontos, aumentos e juros: a matemática que o ENEM cobra em quase toda edição.",
    ),
    key: "percentages",
    lessons: [
      outlineLesson(
        "what-a-percent-is",
        {
          description: t(
            "A percent is a fraction of 100, and that's all you need.",
            "Porcentagem é uma fração de 100, e isso é tudo de que você precisa.",
          ),
          title: t("What a percent is", "O que é porcentagem"),
        },
        ["percent-basics"],
        3,
      ),
      percentDiscountLesson,
      raiseThenDiscountLesson,
      outlineLesson(
        "percent-change",
        {
          description: t(
            "How much something grew, as a share of where it started.",
            "Quanto algo cresceu, em relação a onde começou.",
          ),
          title: t("Percent change", "Variação percentual"),
        },
        ["percent-change"],
      ),
      outlineLesson(
        "compound-interest",
        {
          description: t(
            "Why interest on interest makes debts and savings snowball.",
            "Por que juros sobre juros fazem dívidas e poupanças virarem bola de neve.",
          ),
          title: t("Simple and compound interest", "Juros simples e compostos"),
        },
        ["compound-interest"],
        5,
      ),
    ],
    level: "beginner",
    objectives: [
      t(
        "Work out discounts and real discounts in deals",
        "Calcular descontos e o desconto real das promoções",
      ),
      t("Combine percent changes in a row", "Combinar variações percentuais seguidas"),
      t(
        "Calculate percent change and compound interest",
        "Calcular variação percentual e juros compostos",
      ),
    ],
    title: t("Percentages", "Porcentagem"),
    weight: 5,
  },
  {
    area: MATH,
    description: t(
      "Proportions, the rule of three and map scales.",
      "Proporções, regra de três e escalas.",
    ),
    key: "ratio-proportion",
    lessons: [
      outlineLesson(
        "rule-of-three",
        {
          description: t(
            "Find the missing value when two quantities grow together.",
            "Ache o valor que falta quando duas grandezas crescem juntas.",
          ),
          title: t("The rule of three", "Regra de três"),
        },
        ["rule-of-three"],
      ),
      outlineLesson(
        "map-scales",
        {
          description: t(
            "Turn centimeters on a map into kilometers on the ground.",
            "Transforme centímetros no mapa em quilômetros no terreno.",
          ),
          title: t("Scales and maps", "Escalas e mapas"),
        },
        ["map-scale"],
      ),
    ],
    level: "beginner",
    objectives: [t("Solve proportions and map scales", "Resolver proporções e escalas")],
    title: t("Ratios and proportions", "Razão e proporção"),
    weight: 3,
  },
  {
    area: MATH,
    description: t(
      "Linear and quadratic functions in everyday situations.",
      "Funções do 1º e do 2º grau em situações do dia a dia.",
    ),
    key: "functions",
    lessons: [
      outlineLesson(
        "linear-function",
        {
          description: t(
            "A fixed fee plus a rate: taxis, phone plans and salaries.",
            "Um valor fixo mais uma taxa: táxi, plano de celular e salário.",
          ),
          title: t("Linear functions", "Função do 1º grau"),
        },
        ["linear-function"],
      ),
      outlineLesson(
        "quadratic-function",
        {
          description: t(
            "Where a parabola peaks, and why ENEM asks for maximum profit.",
            "Onde a parábola atinge o topo, e por que o ENEM pede o lucro máximo.",
          ),
          title: t("Quadratic functions", "Função do 2º grau"),
        },
        ["quadratic-function"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t(
        "Model situations with linear and quadratic functions",
        "Modelar situações com funções do 1º e do 2º grau",
      ),
    ],
    title: t("Functions", "Funções"),
    weight: 3,
  },
  {
    area: MATH,
    description: t(
      "Averages and the charts ENEM fills its questions with.",
      "Médias e os gráficos que o ENEM usa em tantas questões.",
    ),
    key: "statistics",
    lessons: [
      outlineLesson(
        "mean-median-mode",
        {
          description: t(
            "Three ways to say what's typical, and when each one lies.",
            "Três jeitos de dizer o que é típico, e quando cada um engana.",
          ),
          title: t("Mean, median and mode", "Média, mediana e moda"),
        },
        ["central-tendency"],
      ),
      outlineLesson(
        "reading-charts",
        {
          description: t("Read the axes before the numbers.", "Leia os eixos antes dos números."),
          title: t("Reading charts", "Leitura de gráficos"),
        },
        ["read-charts"],
      ),
    ],
    level: "intermediate",
    objectives: [t("Summarize and read data", "Resumir e ler dados")],
    title: t("Statistics", "Estatística"),
    weight: 5,
  },
];

/** Natural Sciences, Humanities, Languages and the essay. */
export const enemAreaChapters: SeedChapter[] = [
  {
    area: SCIENCES,
    description: t(
      "Food chains, cycles and the impact of people on ecosystems.",
      "Cadeias alimentares, ciclos e o impacto humano nos ecossistemas.",
    ),
    key: "ecology",
    lessons: [
      foodChainEnergyLesson,
      outlineLesson(
        "carbon-cycle",
        {
          description: t(
            "Follow a carbon atom from the air into a leaf and back.",
            "Siga um átomo de carbono do ar até uma folha e de volta.",
          ),
          title: t("The carbon cycle", "O ciclo do carbono"),
        },
        ["carbon-cycle"],
      ),
      outlineLesson(
        "human-impact",
        {
          description: t(
            "What happens to a chain when one link disappears.",
            "O que acontece com uma cadeia quando um elo some.",
          ),
          title: t("Human impact on ecosystems", "Impactos ambientais"),
        },
        ["environmental-impact"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t(
        "Explain how energy flows through food chains",
        "Explicar como a energia flui nas cadeias alimentares",
      ),
      t(
        "Trace the carbon cycle and human impacts",
        "Acompanhar o ciclo do carbono e os impactos humanos",
      ),
    ],
    title: t("Ecology", "Ecologia"),
    weight: 5,
  },
  {
    area: SCIENCES,
    description: t(
      "Current, voltage and resistance in simple circuits.",
      "Corrente, tensão e resistência em circuitos simples.",
    ),
    key: "electricity",
    lessons: [
      outlineLesson(
        "ohms-law",
        {
          description: t(
            "One equation that runs every circuit in your house.",
            "Uma equação que comanda todos os circuitos da sua casa.",
          ),
          title: t("Ohm's law", "Lei de Ohm"),
        },
        ["ohms-law"],
      ),
      outlineLesson(
        "series-circuits",
        {
          description: t(
            "Why one broken bulb can switch off the whole string.",
            "Por que uma lâmpada queimada pode apagar o pisca-pisca inteiro.",
          ),
          title: t("Series circuits", "Circuitos em série"),
        },
        ["series-resistors"],
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Solve simple circuits with Ohm's law", "Resolver circuitos simples com a lei de Ohm"),
    ],
    title: t("Electricity", "Eletricidade"),
    weight: 3,
  },
  {
    area: HUMANITIES,
    description: t(
      "From the First Republic to the Vargas Era.",
      "Da Primeira República à Era Vargas.",
    ),
    key: "republic",
    lessons: [
      outlineLesson(
        "first-republic",
        {
          description: t(
            "How São Paulo and Minas Gerais ran the country.",
            "Como São Paulo e Minas Gerais comandaram o país.",
          ),
          title: t("The First Republic", "A Primeira República"),
        },
        ["coffee-with-milk"],
        5,
      ),
      outlineLesson(
        "vargas-era",
        {
          description: t(
            "Labor laws, the Estado Novo and a new kind of state.",
            "Leis trabalhistas, o Estado Novo e um novo tipo de Estado.",
          ),
          title: t("The Vargas Era", "A Era Vargas"),
        },
        ["vargas-era"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t(
        "Explain Brazil's politics from 1889 to 1945",
        "Explicar a política brasileira de 1889 a 1945",
      ),
    ],
    title: t("Brazil's Republic", "Brasil República"),
    weight: 4,
  },
  {
    area: LANGUAGES,
    description: t(
      "Finding the main idea and what a text implies.",
      "Encontrar a ideia central e o que o texto sugere.",
    ),
    key: "reading",
    lessons: [
      outlineLesson(
        "main-idea",
        {
          description: t(
            "Find what every paragraph serves before reading the options.",
            "Ache aquilo a que todo parágrafo serve antes de ler as alternativas.",
          ),
          title: t("The main idea", "A ideia central"),
        },
        ["main-idea"],
      ),
      outlineLesson(
        "what-a-text-implies",
        {
          description: t(
            "What the text makes clear without saying it.",
            "O que o texto deixa claro sem dizer.",
          ),
          title: t("What a text implies", "O que o texto sugere"),
        },
        ["inference"],
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Read for the main idea and inferences", "Ler buscando a ideia central e as inferências"),
    ],
    title: t("Reading comprehension", "Interpretação de texto"),
    weight: 5,
  },
  {
    area: ESSAY,
    description: t(
      "The five competencies and the proposal that closes the essay.",
      "As cinco competências e a proposta que fecha a redação.",
    ),
    key: "essay",
    lessons: [
      outlineLesson(
        "five-competencies",
        {
          description: t(
            "What graders look for, competency by competency.",
            "O que os corretores procuram, competência por competência.",
          ),
          title: t("The five competencies", "As cinco competências"),
        },
        ["essay-competencies"],
      ),
      outlineLesson(
        "intervention-proposal",
        {
          description: t(
            "Who acts, what they do, how, why, and one detail.",
            "Quem age, o que faz, como, para quê, e um detalhamento.",
          ),
          title: t("The intervention proposal", "Proposta de intervenção"),
        },
        ["intervention-proposal"],
        5,
      ),
      outlineLesson(
        "essay-conclusion",
        {
          description: t(
            "Restate the thesis and land the proposal.",
            "Retome a tese e feche com a proposta.",
          ),
          title: t("Writing the conclusion", "Escrevendo a conclusão"),
        },
        ["essay-conclusion"],
        5,
      ),
    ],
    level: "intermediate",
    objectives: [
      t("Know what each competency scores", "Saber o que cada competência avalia"),
      t("Write a complete intervention proposal", "Escrever uma proposta de intervenção completa"),
    ],
    title: t("Essay", "Redação"),
    weight: 5,
    writtenTest: true,
  },
];
