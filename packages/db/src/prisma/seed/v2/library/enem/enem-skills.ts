import { t } from "../../_utils/localize";
import { skill } from "../content";

/** Math skills, the area where the written lessons live: percentages first, since ENEM asks them most. */
export const enemMathSkills = [
  skill("percent-basics", "beginner", {
    description: t(
      "A percent is a fraction of 100: 25% = 25/100 = 0.25. To take a percent of a number, multiply by that decimal.",
      "Porcentagem é uma fração de 100: 25% = 25/100 = 0,25. Para tirar uma porcentagem de um número, multiplique por esse decimal.",
    ),
    example: t("25% of 80 = 0.25 × 80 = 20.", "25% de 80 = 0,25 × 80 = 20."),
    name: t("Turn a percent into a decimal", "Transformar porcentagem em decimal"),
  }),
  skill(
    "percent-discount",
    "beginner",
    {
      description: t(
        "With p% off, you pay (100 − p)% of the price: 25% off R$ 80 is 0.75 × 80 = R$ 60.",
        "Com p% de desconto, você paga (100 − p)% do preço: 25% de desconto em R$ 80 é 0,75 × 80 = R$ 60.",
      ),
      example: t(
        "15% off a R$ 120 shirt: 0.85 × 120 = R$ 102.",
        "15% de desconto numa camisa de R$ 120: 0,85 × 120 = R$ 102.",
      ),
      name: t("Work out a discounted price", "Calcular o preço com desconto"),
      useCase: t(
        "Checking whether a sale is really worth it, at the store or in an ENEM question.",
        "Conferir se uma promoção vale mesmo a pena, na loja ou numa questão do ENEM.",
      ),
    },
    { prerequisites: ["percent-basics"] },
  ),
  skill(
    "buy-x-pay-y",
    "beginner",
    {
      description: t(
        "The real discount is the free items out of all the items: buy 3, pay for 2 is 1/3 ≈ 33.3% off.",
        "O desconto real é o número de itens grátis sobre o total: leve 3, pague 2 é 1/3 ≈ 33,3% de desconto.",
      ),
      example: t(
        "Buy 4, pay for 3: 1 free out of 4 = 25% off.",
        "Leve 4, pague 3: 1 grátis em 4 = 25% de desconto.",
      ),
      name: t(
        "Find the real discount in “buy X, pay for Y”",
        "Achar o desconto real do “leve X, pague Y”",
      ),
      useCase: t(
        "Comparing supermarket deals, one of ENEM's favorite settings.",
        "Comparar promoções de supermercado, um dos cenários preferidos do ENEM.",
      ),
    },
    { prerequisites: ["percent-discount"] },
  ),
  skill(
    "percent-factor",
    "beginner",
    {
      description: t(
        "A rise of p% multiplies by (1 + p/100) and a drop multiplies by (1 − p/100): +10% is × 1.1, −10% is × 0.9.",
        "Um aumento de p% multiplica por (1 + p/100) e uma queda por (1 − p/100): +10% é × 1,1 e −10% é × 0,9.",
      ),
      example: t(
        "A 15% raise multiplies a salary by 1.15.",
        "Um aumento de 15% multiplica o salário por 1,15.",
      ),
      name: t(
        "Turn a percent change into a multiplier",
        "Transformar variação percentual em fator",
      ),
      useCase: t(
        "Reading any price, salary or investment that changes by a percent.",
        "Ler qualquer preço, salário ou investimento que muda em porcentagem.",
      ),
    },
    { prerequisites: ["percent-basics"] },
  ),
  skill(
    "successive-percent",
    "beginner",
    {
      description: t(
        "Percent changes in a row multiply: +10% then −10% is 1.1 × 0.9 = 0.99, a 1% loss.",
        "Variações seguidas se multiplicam: +10% e depois −10% é 1,1 × 0,9 = 0,99, uma perda de 1%.",
      ),
      example: t(
        "+20% then −20% leaves 1.2 × 0.8 = 96% of the start.",
        "+20% e depois −20% deixa 1,2 × 0,8 = 96% do início.",
      ),
      name: t("Combine percent changes in a row", "Combinar variações percentuais seguidas"),
      useCase: t(
        "Prices, salaries and investments that go up and down over time, and the trap ENEM loves.",
        "Preços, salários e investimentos que sobem e descem com o tempo, e a pegadinha que o ENEM adora.",
      ),
    },
    { hard: true, prerequisites: ["percent-factor"] },
  ),
  skill(
    "percent-change",
    "beginner",
    {
      description: t(
        "A percent change is (new − old) ÷ old: from 50 to 60 is a 20% rise.",
        "A variação percentual é (novo − antigo) ÷ antigo: de 50 para 60 é um aumento de 20%.",
      ),
      name: t("Calculate a percent change", "Calcular a variação percentual"),
    },
    { prerequisites: ["percent-basics"] },
  ),
  skill(
    "compound-interest",
    "beginner",
    {
      description: t(
        "Each period multiplies by (1 + rate): R$ 1,000 at 1% a month for a year is 1,000 × 1.01¹².",
        "Cada período multiplica por (1 + taxa): R$ 1.000 a 1% ao mês por um ano é 1.000 × 1,01¹².",
      ),
      name: t("Calculate compound interest", "Calcular juros compostos"),
    },
    { prerequisites: ["percent-factor"] },
  ),
  skill("rule-of-three", "beginner", {
    description: t(
      "When two quantities grow together, their ratio stays the same: if 3 kg cost R$ 12, 5 kg cost R$ 20.",
      "Quando duas grandezas crescem juntas, a razão se mantém: se 3 kg custam R$ 12, 5 kg custam R$ 20.",
    ),
    name: t("Solve proportions with the rule of three", "Resolver proporções com regra de três"),
  }),
  skill(
    "map-scale",
    "beginner",
    {
      description: t(
        "At a 1:100,000 scale, 1 cm on the map is 1 km on the ground.",
        "Na escala 1:100.000, 1 cm no mapa é 1 km no terreno.",
      ),
      name: t("Use map scales", "Usar escalas"),
    },
    { prerequisites: ["rule-of-three"] },
  ),
  skill("linear-function", "intermediate", {
    description: t(
      "f(x) = ax + b is a fixed amount b plus a rate a for each unit, like a taxi fare.",
      "f(x) = ax + b é um valor fixo b mais uma taxa a por unidade, como a corrida de táxi.",
    ),
    name: t("Model with a linear function", "Modelar com função do 1º grau"),
  }),
  skill(
    "quadratic-function",
    "intermediate",
    {
      description: t(
        "A parabola y = ax² + bx + c has its maximum or minimum at x = −b/(2a).",
        "A parábola y = ax² + bx + c tem seu máximo ou mínimo em x = −b/(2a).",
      ),
      name: t("Find the vertex of a parabola", "Achar o vértice de uma parábola"),
    },
    { prerequisites: ["linear-function"] },
  ),
  skill("central-tendency", "intermediate", {
    description: t(
      "The mean adds and divides, the median is the middle value in order, the mode is the most common one.",
      "A média soma e divide, a mediana é o valor do meio em ordem, a moda é o mais frequente.",
    ),
    name: t("Find the mean, median and mode", "Calcular média, mediana e moda"),
  }),
  skill("read-charts", "intermediate", {
    description: t(
      "Read the title, the axes and the units before the numbers, then compare what the question asks.",
      "Leia o título, os eixos e as unidades antes dos números, e só então compare o que a questão pede.",
    ),
    name: t("Read charts and tables", "Ler gráficos e tabelas"),
  }),
];

/** Natural Sciences, Humanities, Languages and the essay: what the diagnostic and mocks mix in. */
export const enemAreaSkills = [
  skill("energy-flow", "intermediate", {
    description: t(
      "At each level of a food chain, most energy is spent on living and lost as heat; only about 10% becomes food for the next level.",
      "Em cada nível da cadeia alimentar, a maior parte da energia é gasta para viver e perdida como calor; só cerca de 10% vira alimento para o nível seguinte.",
    ),
    example: t(
      "A frog that eats 100 kcal of grasshoppers turns only about 10 kcal into frog.",
      "Um sapo que come 100 kcal de gafanhotos transforma só cerca de 10 kcal em sapo.",
    ),
    name: t(
      "Explain why energy shrinks at each trophic level",
      "Explicar por que a energia diminui a cada nível trófico",
    ),
    useCase: t(
      "Explains why big predators are rare and why plant-based diets use less land.",
      "Explica por que grandes predadores são raros e por que dietas à base de plantas usam menos terra.",
    ),
  }),
  skill(
    "ten-percent-rule",
    "intermediate",
    {
      description: t(
        "Multiply by about 0.1 for each step up a food chain.",
        "Multiplique por cerca de 0,1 a cada degrau da cadeia alimentar.",
      ),
      example: t(
        "10,000 kcal in grass leaves about 10 kcal for the snakes, three levels up.",
        "10.000 kcal no capim deixam cerca de 10 kcal para as cobras, três níveis acima.",
      ),
      name: t(
        "Estimate the energy that reaches each level",
        "Estimar a energia que chega a cada nível",
      ),
      useCase: t(
        "ENEM questions about energy pyramids and food chains.",
        "Questões do ENEM sobre pirâmides de energia e cadeias alimentares.",
      ),
    },
    { prerequisites: ["energy-flow"] },
  ),
  skill(
    "carbon-cycle",
    "intermediate",
    {
      description: t(
        "Carbon moves from the air into plants by photosynthesis and back by respiration, decay and burning.",
        "O carbono vai do ar para as plantas pela fotossíntese e volta pela respiração, decomposição e queima.",
      ),
      name: t("Trace the carbon cycle", "Acompanhar o ciclo do carbono"),
    },
    { prerequisites: ["energy-flow"] },
  ),
  skill("environmental-impact", "intermediate", {
    description: t(
      "Deforestation, pollution and invasive species break food chains and cycles that ecosystems depend on.",
      "Desmatamento, poluição e espécies invasoras quebram cadeias e ciclos dos quais os ecossistemas dependem.",
    ),
    name: t("Explain human impacts on ecosystems", "Explicar impactos humanos nos ecossistemas"),
  }),
  skill("ohms-law", "intermediate", {
    description: t(
      "Current is voltage divided by resistance: I = U ÷ R.",
      "A corrente é a tensão dividida pela resistência: I = U ÷ R.",
    ),
    name: t("Apply Ohm's law", "Aplicar a lei de Ohm"),
  }),
  skill(
    "series-resistors",
    "intermediate",
    {
      description: t(
        "In series, resistances add up and the same current flows through all of them.",
        "Em série, as resistências se somam e a mesma corrente passa por todas.",
      ),
      name: t("Solve series circuits", "Resolver circuitos em série"),
    },
    { prerequisites: ["ohms-law"] },
  ),
  skill("coffee-with-milk", "intermediate", {
    description: t(
      "From 1894 to 1930, the elites of São Paulo and Minas Gerais dominated Brazil's presidency, often taking turns.",
      "De 1894 a 1930, as elites de São Paulo e Minas Gerais dominaram a presidência, muitas vezes se alternando.",
    ),
    name: t(
      "Explain the First Republic's coffee-with-milk politics",
      "Explicar a política do café com leite",
    ),
  }),
  skill(
    "vargas-era",
    "intermediate",
    {
      description: t(
        "From 1930 to 1945, Getúlio Vargas centralized power, created labor laws and ruled as a dictator in the Estado Novo.",
        "De 1930 a 1945, Getúlio Vargas centralizou o poder, criou leis trabalhistas e governou como ditador no Estado Novo.",
      ),
      name: t("Describe the Vargas Era", "Descrever a Era Vargas"),
    },
    { prerequisites: ["coffee-with-milk"] },
  ),
  skill("main-idea", "intermediate", {
    description: t(
      "The main idea is what every paragraph serves; find it before reading the options.",
      "A ideia central é aquilo a que todos os parágrafos servem; ache-a antes de ler as alternativas.",
    ),
    name: t("Find a text's main idea", "Identificar a ideia central de um texto"),
  }),
  skill(
    "inference",
    "intermediate",
    {
      description: t(
        "An inference is what the text makes clear without saying it, and it always rests on something written.",
        "Uma inferência é o que o texto deixa claro sem dizer, e sempre se apoia em algo escrito.",
      ),
      name: t("Infer what a text implies", "Inferir o que o texto sugere"),
    },
    { prerequisites: ["main-idea"] },
  ),
  skill("essay-competencies", "intermediate", {
    description: t(
      "The essay is scored on five competencies, from 0 to 200 each: grammar, the theme, the argument, cohesion and the intervention proposal.",
      "A redação vale cinco competências, de 0 a 200 cada: norma culta, tema, argumentação, coesão e proposta de intervenção.",
    ),
    name: t("Know the five essay competencies", "Conhecer as cinco competências da redação"),
  }),
  skill(
    "intervention-proposal",
    "intermediate",
    {
      description: t(
        "A complete proposal says who acts, what they do, how, for what purpose, and adds one detail.",
        "Uma proposta completa diz quem age, o que faz, como faz, para quê, e traz um detalhamento.",
      ),
      name: t(
        "Write a complete intervention proposal",
        "Escrever uma proposta de intervenção completa",
      ),
    },
    { prerequisites: ["essay-competencies"] },
  ),
  skill(
    "essay-conclusion",
    "intermediate",
    {
      description: t(
        "The conclusion restates the thesis in one sentence and closes with the intervention proposal.",
        "A conclusão retoma a tese em uma frase e fecha com a proposta de intervenção.",
      ),
      name: t("Write an essay conclusion", "Escrever a conclusão da redação"),
    },
    { prerequisites: ["intervention-proposal"] },
  ),
];
