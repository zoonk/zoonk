import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Ecology chapter, lesson 1. Starts from a guess about a pasture, explains where the energy goes
 * (respiration and heat), turns that into the 10% estimate and ends on an ENEM-style question
 * that applies it to diets and land use.
 */
export const foodChainEnergyLesson: SeedLesson = {
  canDo: t(
    "You'll explain why big predators are rare and estimate the energy left at each level of a food chain.",
    "Você vai explicar por que grandes predadores são raros e estimar a energia que sobra em cada nível de uma cadeia alimentar.",
  ),
  description: t(
    "Where the energy of a food chain goes, and why only about a tenth moves up each level.",
    "Para onde vai a energia de uma cadeia alimentar, e por que só cerca de um décimo sobe a cada nível.",
  ),
  key: "food-chain-energy",
  minutes: 6,
  skills: ["energy-flow", "ten-percent-rule"],
  steps: [
    {
      content: {
        options: [
          guess("most", t("About 7,500 kcal", "Cerca de 7.500 kcal")),
          guess("tenth", t("About 1,000 kcal", "Cerca de 1.000 kcal")),
          guess("thousandth", t("About 10 kcal", "Cerca de 10 kcal"), true),
          guess("all", t("All of it: energy isn't lost", "Tudo: energia não se perde")),
        ],
        question: t(
          "The grass in a pasture holds 10,000 kcal. Grasshoppers eat the grass, frogs eat the grasshoppers, snakes eat the frogs. How much of that energy reaches the snakes?",
          "O capim de um pasto guarda 10.000 kcal. Gafanhotos comem o capim, sapos comem os gafanhotos, cobras comem os sapos. Quanto dessa energia chega às cobras?",
        ),
        reveal: t(
          "About 10 kcal, a thousandth of what the grass had. Each step keeps roughly a tenth and loses the rest, mostly as heat.",
          "Cerca de 10 kcal, um milésimo do que o capim tinha. Cada degrau guarda mais ou menos um décimo e perde o resto, principalmente como calor.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "Each link of a food chain is a **trophic level**:\n\n- **Producers** make their own food from sunlight: the grass\n- **Primary consumers** eat producers: the grasshopper\n- **Secondary consumers** eat them: the frog\n- **Tertiary consumers** come next: the snake\n\nEnergy enters as sunlight and moves up one meal at a time.",
          "Cada elo de uma cadeia alimentar é um **nível trófico**:\n\n- **Produtores** fazem o próprio alimento com a luz do sol: o capim\n- **Consumidores primários** comem os produtores: o gafanhoto\n- **Consumidores secundários** comem esses: o sapo\n- **Consumidores terciários** vêm depois: a cobra\n\nA energia entra como luz do sol e sobe uma refeição de cada vez.",
        ),
        title: t("Levels in a food chain", "Os níveis de uma cadeia alimentar"),
      },
      kind: "explanation",
      skill: "energy-flow",
    },
    {
      content: {
        text: t(
          "Most of what an animal eats never becomes more animal. A grasshopper spends energy moving, growing and staying alive, and its **cellular respiration** releases much of it as heat. Part of the food isn't even digested and leaves as waste.\n\nOnly about **10%** becomes body the next level can eat.",
          "Quase tudo o que um animal come nunca vira mais animal. O gafanhoto gasta energia para se mexer, crescer e se manter vivo, e a **respiração celular** libera boa parte dela como calor. Parte do alimento nem é digerida e sai nas fezes.\n\nSó cerca de **10%** vira corpo que o próximo nível pode comer.",
        ),
        title: t("Where does the energy go?", "Para onde vai a energia?"),
      },
      kind: "explanation",
      skill: "energy-flow",
    },
    {
      content: {
        options: [
          option(
            "ten",
            t("About 10 kcal", "Cerca de 10 kcal"),
            t(
              "About a tenth becomes frog: 10% of 100.",
              "Cerca de um décimo vira sapo: 10% de 100.",
            ),
            true,
          ),
          option(
            "ninety",
            t("About 90 kcal", "Cerca de 90 kcal"),
            t(
              "90 kcal is roughly what the frog uses up and loses, mostly as heat.",
              "90 kcal é mais ou menos o que o sapo gasta e perde, principalmente como calor.",
            ),
          ),
          option(
            "hundred",
            t("All 100 kcal", "Todas as 100 kcal"),
            t(
              "The frog spends most of that energy living and moving first.",
              "O sapo precisa primeiro viver, se mexer e se manter com essa energia.",
            ),
          ),
          option(
            "fifty",
            t("About 50 kcal", "Cerca de 50 kcal"),
            t(
              "Much less than half makes it: about 10%.",
              "Bem menos da metade sobe: cerca de 10%.",
            ),
          ),
        ],
        question: t(
          "A frog eats 100 kcal of grasshoppers. On average, how much becomes frog, available to a snake?",
          "Um sapo come 100 kcal de gafanhotos. Em média, quanto vira sapo, disponível para uma cobra?",
        ),
      },
      kind: "check",
      skill: "ten-percent-rule",
    },
    {
      content: {
        problem: t(
          "The algae in a lake store 50,000 kcal. Zooplankton eat the algae, small fish eat the zooplankton, and big fish eat the small fish. How much reaches the big fish?",
          "As algas de um lago guardam 50.000 kcal. O zooplâncton come as algas, peixes pequenos comem o zooplâncton e peixes grandes comem os pequenos. Quanto chega aos peixes grandes?",
        ),
        result: t(
          "About 50 kcal, 0.1% of what the algae made. That's why a lake can feed millions of tiny animals but only a few big fish.",
          "Cerca de 50 kcal, 0,1% do que as algas produziram. Por isso um lago alimenta milhões de bichinhos, mas poucos peixes grandes.",
        ),
        steps: [
          {
            math: t(
              String.raw`50\,000 \times 0.1 = 5\,000`,
              String.raw`50\,000 \times 0{,}1 = 5\,000`,
            ),
            text: t(
              "Zooplankton keep about a tenth of the algae's energy.",
              "O zooplâncton guarda cerca de um décimo da energia das algas.",
            ),
          },
          {
            math: t(String.raw`5\,000 \times 0.1 = 500`, String.raw`5\,000 \times 0{,}1 = 500`),
            text: t(
              "Small fish keep a tenth of that.",
              "Os peixes pequenos guardam um décimo disso.",
            ),
          },
          {
            math: t(String.raw`500 \times 0.1 = 50`, String.raw`500 \times 0{,}1 = 50`),
            text: t("Big fish keep a tenth again.", "Os peixes grandes, um décimo de novo."),
          },
        ],
        title: t("An energy pyramid", "Uma pirâmide de energia"),
      },
      kind: "workedExample",
      skill: "ten-percent-rule",
    },
    {
      content: {
        check: {
          answer: 10_000,
          explanation: t(
            "Two levels up: 1,000,000 × 0.1 × 0.1 = 10,000 kcal, just 1% of what the plants captured.",
            "Dois níveis acima: 1.000.000 × 0,1 × 0,1 = 10.000 kcal, só 1% do que as plantas captaram.",
          ),
          kind: "numeric",
          question: t("How many kcal reach the jaguars?", "Quantas kcal chegam às onças?"),
          tolerance: { kind: "relative", value: 0.01 },
          unit: "kcal",
        },
        fields: {
          comparison: t(
            "A hundredth of the plants' energy: that's why a single jaguar needs a huge territory.",
            "Um centésimo da energia das plantas: por isso uma única onça precisa de um território enorme.",
          ),
          expression: "1000000 * 0.1^2",
          max: 1_000_000,
          min: 1,
          scale: "log",
          takeaway: t(
            "Each level multiplies by about 0.1, so two levels up keeps 0.1 × 0.1 = 1%.",
            "Cada nível multiplica por cerca de 0,1, então dois níveis acima sobra 0,1 × 0,1 = 1%.",
          ),
          unit: "kcal",
          workings: [
            { expression: "1000000 * 0.1", label: t("Capybaras (level 2)", "Capivaras (nível 2)") },
            { expression: "1000000 * 0.1^2", label: t("Jaguars (level 3)", "Onças (nível 3)") },
          ],
        },
        prompt: t(
          "The plants of a wetland capture 1,000,000 kcal. Capybaras eat the plants and jaguars eat the capybaras. Guess first: how much reaches the jaguars?",
          "As plantas de um pantanal captam 1.000.000 kcal. Capivaras comem as plantas e onças comem as capivaras. Chute primeiro: quanto chega às onças?",
        ),
        template: "estimateReveal",
      },
      kind: "activity",
      skill: "ten-percent-rule",
    },
    {
      content: {
        context: t(
          "A student claims that a diet based on plants needs less farmland than one based on beef.",
          "Um estudante afirma que uma alimentação baseada em vegetais precisa de menos área de plantio do que uma baseada em carne bovina.",
        ),
        options: [
          option(
            "a",
            t(
              "Energy shrinks at each trophic level, so eating one level lower uses the plants' energy better.",
              "A energia diminui a cada nível trófico, então comer um nível abaixo aproveita melhor a energia das plantas.",
            ),
            t(
              "Cattle keep only a small part of what they eat as meat, so feeding people directly from plants needs far less land.",
              "O boi guarda só uma pequena parte do que come como carne, então alimentar pessoas direto com vegetais exige muito menos terra.",
            ),
            true,
          ),
          option(
            "b",
            t("Plants have more protein than meat.", "Os vegetais têm mais proteína que a carne."),
            t(
              "Protein isn't the argument here. The claim is about the energy lost between levels.",
              "A proteína não é o argumento. A afirmação é sobre a energia perdida entre os níveis.",
            ),
          ),
          option(
            "c",
            t(
              "Beef is produced faster than plants.",
              "A carne bovina é produzida mais rápido que os vegetais.",
            ),
            t(
              "Speed isn't the issue: raising cattle means feeding plants to an animal that keeps only a small part as meat.",
              "A velocidade não é a questão: criar gado é dar vegetais a um animal que guarda só uma pequena parte como carne.",
            ),
          ),
          option(
            "d",
            t(
              "Cattle make part of their own energy by photosynthesis.",
              "O gado produz parte da própria energia por fotossíntese.",
            ),
            t(
              "Only producers photosynthesize. Cattle get all their energy by eating.",
              "Só produtores fazem fotossíntese. O gado obtém toda a energia comendo.",
            ),
          ),
          option(
            "e",
            t(
              "Decomposers recycle the organic matter.",
              "Os decompositores reciclam a matéria orgânica.",
            ),
            t(
              "True, but that's about nutrients. Energy lost as heat isn't recycled.",
              "É verdade, mas isso vale para os nutrientes. A energia perdida como calor não é reciclada.",
            ),
          ),
        ],
        question: t(
          "Which ecological principle supports this claim?",
          "Qual princípio ecológico sustenta essa afirmação?",
        ),
      },
      kind: "check",
      screen: "application",
      skill: "energy-flow",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "A food chain moves energy up from producers to consumers, one meal at a time.",
              "Uma cadeia alimentar leva energia dos produtores aos consumidores, uma refeição de cada vez.",
            ),
          },
          {
            text: t(
              "At each level, most energy is used to live and lost as heat in respiration.",
              "Em cada nível, a maior parte da energia é usada para viver e perdida como calor na respiração.",
            ),
          },
          {
            text: t(
              "Only about 10% moves up: multiply by 0.1 per level.",
              "Só cerca de 10% sobe: multiplique por 0,1 a cada nível.",
            ),
          },
          {
            text: t(
              "That's why top predators are rare and eating lower on the chain uses less land.",
              "Por isso predadores de topo são raros e comer mais abaixo na cadeia usa menos terra.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "explanationFirst",
  title: t("Energy in food chains", "Energia nas cadeias alimentares"),
};
