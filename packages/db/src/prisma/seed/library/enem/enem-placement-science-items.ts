import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** Hard-to-guess questions, so placement can confirm these skills without writing any. */
export const enemPlacementScienceItems: SeedItem[] = [
  {
    content: {
      pairs: [
        { left: t("Force", "Força"), right: t("Newton (N)", "Newton (N)") },
        { left: t("Energy", "Energia"), right: t("Joule (J)", "Joule (J)") },
        { left: t("Power", "Potência"), right: t("Watt (W)", "Watt (W)") },
        { left: t("Pressure", "Pressão"), right: t("Pascal (Pa)", "Pascal (Pa)") },
        { left: t("Electric charge", "Carga elétrica"), right: t("Coulomb (C)", "Coulomb (C)") },
      ],
      question: t(
        "Match each quantity with its unit in the International System.",
        "Ligue cada grandeza à sua unidade no Sistema Internacional.",
      ),
      reason: t(
        "Force is in newtons, energy in joules, power in watts, pressure in pascals and charge in coulombs.",
        "Força se mede em newtons, energia em joules, potência em watts, pressão em pascals e carga em coulombs.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-units-si-match",
    skill: "physical-units",
  },
  {
    content: {
      question: t(
        "Put these lengths in order, from shortest to longest.",
        "Coloque estes comprimentos em ordem, do menor para o maior.",
      ),
      reason: t(
        "In millimeters they are 3, 5, 20, 45 and 100.",
        "Em milímetros, eles valem 3, 5, 20, 45 e 100.",
      ),
      steps: [
        t("3 mm", "3 mm"),
        t("0.5 cm", "0,5 cm"),
        t("0.02 m", "0,02 m"),
        t("45 mm", "45 mm"),
        t("0.1 m", "0,1 m"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-units-lengths-order",
    skill: "physical-units",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("20 m/s", "20 m/s"),
          t(
            "72 km/h is 72,000 m in 3,600 s, which is 20 m/s.",
            "72 km/h são 72.000 m em 3.600 s, ou seja, 20 m/s.",
          ),
        ),
        bankOption(
          t("1.2 km/min", "1,2 km/min"),
          t("An hour has 60 minutes: 72 ÷ 60 = 1.2.", "Uma hora tem 60 minutos: 72 ÷ 60 = 1,2."),
        ),
        bankOption(
          t("1,200 m/min", "1.200 m/min"),
          t(
            "1.2 km is 1,200 m, covered each minute.",
            "1,2 km são 1.200 m, percorridos a cada minuto.",
          ),
        ),
        bankOption(
          t("7.2 m/s", "7,2 m/s"),
          t(
            "From km/h to m/s you divide by 3.6, not by 10.",
            "De km/h para m/s se divide por 3,6, não por 10.",
          ),
          t("Divided by 10 instead of 3.6", "Dividiu por 10 em vez de 3,6"),
        ),
        bankOption(
          t("259.2 m/s", "259,2 m/s"),
          t(
            "Meters per second is a smaller number than km/h, so you divide by 3.6.",
            "Metros por segundo dão um número menor que km/h, então se divide por 3,6.",
          ),
          t("Multiplied by 3.6 instead of dividing", "Multiplicou por 3,6 em vez de dividir"),
        ),
        bankOption(
          t("72,000 m/s", "72.000 m/s"),
          t(
            "That turns the kilometers into meters but leaves the hour as if it were a second.",
            "Isso troca quilômetros por metros, mas deixa a hora como se fosse um segundo.",
          ),
          t(
            "Converted the kilometers but not the hours",
            "Converteu os quilômetros, mas não as horas",
          ),
        ),
      ],
      question: t(
        "Which of these speeds are the same as 72 km/h? Select all that apply.",
        "Quais destas velocidades são iguais a 72 km/h? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-units-speed-all",
    skill: "physical-units",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Potassium (K)", "Potássio (K)"),
          t(
            "Potassium sits in period 4, one shell more than the others, at the far left of its row.",
            "O potássio está no 4º período, com uma camada a mais que os outros, no começo da sua linha.",
          ),
        ),
        bankOption(
          t("Sodium (Na)", "Sódio (Na)"),
          t(
            "Sodium is right above potassium in group 1, so it has one shell less.",
            "O sódio fica logo acima do potássio no grupo 1, então tem uma camada a menos.",
          ),
          t("Thinks the radius shrinks down a group", "Acha que o raio diminui ao descer um grupo"),
        ),
        bankOption(
          t("Magnesium (Mg)", "Magnésio (Mg)"),
          t(
            "Magnesium is to the right of sodium in period 3: more protons pull its shells in.",
            "O magnésio fica à direita do sódio no 3º período: mais prótons puxam suas camadas.",
          ),
          t(
            "Thinks the radius grows across a period",
            "Acha que o raio aumenta ao longo de um período",
          ),
        ),
        bankOption(
          t("Chlorine (Cl)", "Cloro (Cl)"),
          t(
            "Chlorine has more electrons than sodium but the same shells, pulled in by 17 protons.",
            "O cloro tem mais elétrons que o sódio, mas as mesmas camadas, puxadas por 17 prótons.",
          ),
          t(
            "Thinks more electrons always make a bigger atom",
            "Acha que mais elétrons sempre deixam o átomo maior",
          ),
        ),
      ],
      question: t(
        "Which of these elements has the largest atomic radius?",
        "Qual destes elementos tem o maior raio atômico?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-periodic-largest-radius",
    skill: "periodic-properties",
  },
  {
    content: {
      pairs: [
        { left: t("Sodium", "Sódio"), right: t("Alkali metals", "Metais alcalinos") },
        {
          left: t("Calcium", "Cálcio"),
          right: t("Alkaline earth metals", "Metais alcalinoterrosos"),
        },
        { left: t("Oxygen", "Oxigênio"), right: t("Chalcogens", "Calcogênios") },
        { left: t("Chlorine", "Cloro"), right: t("Halogens", "Halogênios") },
        { left: t("Neon", "Neônio"), right: t("Noble gases", "Gases nobres") },
      ],
      question: t(
        "Match each element with its family in the periodic table.",
        "Ligue cada elemento à sua família na tabela periódica.",
      ),
      reason: t(
        "Sodium is in group 1, calcium in group 2, oxygen in group 16, chlorine in group 17 and neon in group 18.",
        "O sódio está no grupo 1, o cálcio no 2, o oxigênio no 16, o cloro no 17 e o neônio no 18.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-periodic-families-match",
    skill: "periodic-properties",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("Atomic radius grows down a group.", "O raio atômico aumenta ao descer um grupo."),
          t(
            "Each row down adds an electron shell.",
            "Cada linha abaixo acrescenta uma camada eletrônica.",
          ),
        ),
        bankOption(
          t(
            "Electronegativity grows from left to right across a period.",
            "A eletronegatividade aumenta da esquerda para a direita em um período.",
          ),
          t(
            "More protons in the same shells pull shared electrons harder.",
            "Mais prótons nas mesmas camadas atraem mais os elétrons compartilhados.",
          ),
        ),
        bankOption(
          t(
            "First ionization energy falls down a group.",
            "A primeira energia de ionização diminui ao descer um grupo.",
          ),
          t(
            "The outer electron sits farther from the nucleus, so it's easier to remove.",
            "O elétron mais externo fica mais longe do núcleo, então é mais fácil de retirar.",
          ),
        ),
        bankOption(
          t(
            "Noble gases are the most reactive elements.",
            "Os gases nobres são os elementos mais reativos.",
          ),
          t(
            "Their full outer shell makes them the least reactive.",
            "A camada externa completa os torna os menos reativos.",
          ),
          t("Mixed up stable and reactive", "Confundiu estável com reativo"),
        ),
        bankOption(
          t("Metals tend to gain electrons.", "Os metais tendem a ganhar elétrons."),
          t(
            "Metals tend to lose electrons and form positive ions.",
            "Os metais tendem a perder elétrons e formar íons positivos.",
          ),
          t("Mixed up metals and nonmetals", "Confundiu metais com ametais"),
        ),
      ],
      question: t(
        "Which statements about the periodic table are true? Select all that apply.",
        "Quais afirmações sobre a tabela periódica são verdadeiras? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-periodic-trends-all",
    skill: "periodic-properties",
  },
  {
    content: {
      question: t(
        "Put these period 3 elements in order, from lowest to highest electronegativity.",
        "Coloque estes elementos do 3º período em ordem, da menor para a maior eletronegatividade.",
      ),
      reason: t(
        "Across a period, electronegativity grows from left to right: Na, Mg, Al, S, Cl.",
        "Ao longo de um período, a eletronegatividade cresce da esquerda para a direita: Na, Mg, Al, S, Cl.",
      ),
      steps: [
        t("Sodium (Na)", "Sódio (Na)"),
        t("Magnesium (Mg)", "Magnésio (Mg)"),
        t("Aluminum (Al)", "Alumínio (Al)"),
        t("Sulfur (S)", "Enxofre (S)"),
        t("Chlorine (Cl)", "Cloro (Cl)"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-periodic-electronegativity-order",
    skill: "periodic-properties",
  },
  {
    content: {
      pairs: [
        { left: t("Producers", "Produtores"), right: t("50,000 kcal", "50.000 kcal") },
        {
          left: t("Primary consumers", "Consumidores primários"),
          right: t("5,000 kcal", "5.000 kcal"),
        },
        {
          left: t("Secondary consumers", "Consumidores secundários"),
          right: t("500 kcal", "500 kcal"),
        },
        {
          left: t("Tertiary consumers", "Consumidores terciários"),
          right: t("50 kcal", "50 kcal"),
        },
      ],
      question: t(
        "Producers capture 50,000 kcal. Match each level with about how much energy reaches it.",
        "Os produtores captam 50.000 kcal. Ligue cada nível à energia que chega a ele, aproximadamente.",
      ),
      reason: t(
        "Each level keeps about a tenth of the one below: 50,000, 5,000, 500, 50.",
        "Cada nível fica com cerca de um décimo do nível abaixo: 50.000, 5.000, 500, 50.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-energy-levels-match",
    skill: "ten-percent-rule",
  },
  {
    content: {
      question: t(
        "In a food chain, each level keeps about 10% of the energy of the level below. Put these amounts in order, from the producers to the top predator.",
        "Em uma cadeia alimentar, cada nível fica com cerca de 10% da energia do nível abaixo. Coloque estas quantidades em ordem, dos produtores ao predador do topo.",
      ),
      reason: t(
        "Energy drops at each step up, so the producers have the most and the top predator the least.",
        "A energia cai a cada degrau, então os produtores têm mais e o predador do topo, menos.",
      ),
      steps: [
        t("60,000 kcal", "60.000 kcal"),
        t("6,000 kcal", "6.000 kcal"),
        t("600 kcal", "600 kcal"),
        t("60 kcal", "60 kcal"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-energy-amounts-order",
    skill: "ten-percent-rule",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("About 2,000 kcal reach the caterpillars.", "Cerca de 2.000 kcal chegam às lagartas."),
          t("A tenth of 20,000 is 2,000.", "Um décimo de 20.000 é 2.000."),
        ),
        bankOption(
          t("The birds get about 200 kcal.", "Os pássaros ficam com cerca de 200 kcal."),
          t(
            "A tenth of the caterpillars' 2,000 is 200.",
            "Um décimo das 2.000 kcal das lagartas é 200.",
          ),
        ),
        bankOption(
          t("About 20 kcal reach the hawks.", "Cerca de 20 kcal chegam aos gaviões."),
          t("A tenth of the birds' 200 is 20.", "Um décimo das 200 kcal dos pássaros é 20."),
        ),
        bankOption(
          t("The birds get about 2,000 kcal.", "Os pássaros ficam com cerca de 2.000 kcal."),
          t(
            "2,000 kcal is what reaches the caterpillars. The birds are one level higher.",
            "2.000 kcal é o que chega às lagartas. Os pássaros estão um nível acima.",
          ),
          t("Skipped a level of the chain", "Pulou um nível da cadeia"),
        ),
        bankOption(
          t(
            "The hawks get the most energy, since they eat the others.",
            "Os gaviões ficam com mais energia, já que comem os outros.",
          ),
          t(
            "Most energy is lost at each level, so the top of the chain gets the least.",
            "A maior parte da energia se perde em cada nível, então o topo da cadeia recebe menos.",
          ),
          t("Thinks energy piles up at the top", "Acha que a energia se acumula no topo"),
        ),
        bankOption(
          t(
            "About 90% of the energy passes on to each next level.",
            "Cerca de 90% da energia passa para cada nível seguinte.",
          ),
          t(
            "About 90% is lost at each level. Only about 10% passes on.",
            "Cerca de 90% se perde em cada nível. Só uns 10% passam adiante.",
          ),
          t("Mixed up what is lost and what passes on", "Confundiu o que se perde com o que passa"),
        ),
      ],
      question: t(
        "Grass captures 20,000 kcal in the chain grass → caterpillar → bird → hawk. Which statements fit the 10% rule? Select all that apply.",
        "O capim capta 20.000 kcal na cadeia capim → lagarta → pássaro → gavião. Quais afirmações seguem a regra dos 10%? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-energy-chain-all",
    skill: "ten-percent-rule",
  },
  {
    content: {
      pairs: [
        { left: t("1/8", "1/8"), right: t("0.125", "0,125") },
        { left: t("1/4", "1/4"), right: t("0.25", "0,25") },
        { left: t("3/8", "3/8"), right: t("0.375", "0,375") },
        { left: t("2/5", "2/5"), right: t("0.4", "0,4") },
        { left: t("3/4", "3/4"), right: t("0.75", "0,75") },
      ],
      question: t(
        "Match each fraction with the same number written as a decimal.",
        "Ligue cada fração ao mesmo número escrito na forma decimal.",
      ),
      reason: t(
        "Divide the top by the bottom: 1 ÷ 8 = 0.125, 1 ÷ 4 = 0.25, 3 ÷ 8 = 0.375, 2 ÷ 5 = 0.4 and 3 ÷ 4 = 0.75.",
        "Divida o numerador pelo denominador: 1 ÷ 8 = 0,125, 1 ÷ 4 = 0,25, 3 ÷ 8 = 0,375, 2 ÷ 5 = 0,4 e 3 ÷ 4 = 0,75.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-numbers-fractions-match",
    skill: "estimate-numbers",
  },
  {
    content: {
      question: t(
        "Put these numbers in order, from smallest to largest.",
        "Coloque estes números em ordem, do menor para o maior.",
      ),
      reason: t(
        "−1.5 is below −1/3 (about −0.33), and 0.3 is below 1/3 (about 0.33), which is below 0.35.",
        "−1,5 é menor que −1/3 (cerca de −0,33), e 0,3 é menor que 1/3 (cerca de 0,33), que é menor que 0,35.",
      ),
      steps: [
        t("−1.5", "−1,5"),
        t("−1/3", "−1/3"),
        t("0.3", "0,3"),
        t("1/3", "1/3"),
        t("0.35", "0,35"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-numbers-mixed-order",
    skill: "estimate-numbers",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "A classroom door is about 2.1 m tall.",
            "A porta de uma sala de aula tem cerca de 2,1 m de altura.",
          ),
          t(
            "A door is a little taller than an adult.",
            "Uma porta é um pouco mais alta que um adulto.",
          ),
        ),
        bankOption(
          t(
            "An adult walks about 5 km in an hour.",
            "Um adulto caminha cerca de 5 km em uma hora.",
          ),
          t("That's a normal walking pace.", "Esse é um ritmo normal de caminhada."),
        ),
        bankOption(
          t(
            "A full 1.5 L bottle of water weighs about 1.5 kg.",
            "Uma garrafa cheia de 1,5 L de água pesa cerca de 1,5 kg.",
          ),
          t(
            "A liter of water has a mass of about 1 kg.",
            "Um litro de água tem massa de cerca de 1 kg.",
          ),
        ),
        bankOption(
          t(
            "A car on the highway goes about 100 m/s.",
            "Um carro na estrada anda a cerca de 100 m/s.",
          ),
          t(
            "100 m/s is 360 km/h. A highway car goes about 100 km/h, near 28 m/s.",
            "100 m/s são 360 km/h. Um carro na estrada anda a uns 100 km/h, perto de 28 m/s.",
          ),
          t("Mixed up m/s and km/h", "Confundiu m/s com km/h"),
        ),
        bankOption(
          t(
            "A soccer field is about 100 km long.",
            "Um campo de futebol tem cerca de 100 km de comprimento.",
          ),
          t(
            "A field is about 100 m long, a thousand times less.",
            "Um campo tem cerca de 100 m, mil vezes menos.",
          ),
          t("Picked the wrong unit for the size", "Escolheu a unidade errada para o tamanho"),
        ),
        bankOption(
          t(
            "A grain of rice is about 5 cm long.",
            "Um grão de arroz tem cerca de 5 cm de comprimento.",
          ),
          t("A grain of rice is about 5 mm long.", "Um grão de arroz tem cerca de 5 mm."),
          t("Mixed up centimeters and millimeters", "Confundiu centímetros com milímetros"),
        ),
      ],
      question: t(
        "Which of these measurements make sense? Select all that apply.",
        "Quais destas medidas fazem sentido? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-numbers-sensible-all",
    skill: "estimate-numbers",
  },
  {
    content: {
      pairs: [
        { left: t("20% rise", "Aumento de 20%"), right: t("× 1.2", "× 1,2") },
        { left: t("20% drop", "Queda de 20%"), right: t("× 0.8", "× 0,8") },
        { left: t("5% rise", "Aumento de 5%"), right: t("× 1.05", "× 1,05") },
        { left: t("5% drop", "Queda de 5%"), right: t("× 0.95", "× 0,95") },
        { left: t("100% rise", "Aumento de 100%"), right: t("× 2", "× 2") },
      ],
      question: t(
        "Match each change with the number you multiply by.",
        "Ligue cada variação ao número pelo qual você multiplica.",
      ),
      reason: t(
        "A rise of p% multiplies by 1 + p/100 and a drop by 1 − p/100.",
        "Um aumento de p% multiplica por 1 + p/100 e uma queda, por 1 − p/100.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-factor-changes-match",
    skill: "percent-factor",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("200 × 1.15", "200 × 1,15"),
          t(
            "A 15% rise multiplies by 1.15: 200 × 1.15 = 230.",
            "Um aumento de 15% multiplica por 1,15: 200 × 1,15 = 230.",
          ),
        ),
        bankOption(
          t("200 + 0.15 × 200", "200 + 0,15 × 200"),
          t("The price plus 15% of it: 200 + 30 = 230.", "O preço mais 15% dele: 200 + 30 = 230."),
        ),
        bankOption(
          t("A 15% rise", "Um aumento de 15%"),
          t(
            "15% of R$ 200 is R$ 30, which takes it to R$ 230.",
            "15% de R$ 200 são R$ 30, o que leva a R$ 230.",
          ),
        ),
        bankOption(
          t("200 × 0.15", "200 × 0,15"),
          t(
            "That's only the R$ 30 rise, not the new price.",
            "Isso dá só o aumento de R$ 30, não o novo preço.",
          ),
          t("Used the change itself as the multiplier", "Usou a própria variação como fator"),
        ),
        bankOption(
          t("200 × 1.5", "200 × 1,5"),
          t("1.5 is a 50% rise: 200 × 1.5 = 300.", "1,5 é um aumento de 50%: 200 × 1,5 = 300."),
          t("Wrote 1.15 as 1.5", "Escreveu 1,15 como 1,5"),
        ),
        bankOption(
          t("A 30% rise", "Um aumento de 30%"),
          t(
            "R$ 30 is 15% of R$ 200. A 30% rise would give R$ 260.",
            "R$ 30 são 15% de R$ 200. Um aumento de 30% daria R$ 260.",
          ),
          t("Took the R$ 30 rise as 30%", "Tomou o aumento de R$ 30 como 30%"),
        ),
      ],
      question: t(
        "A product costs R$ 200. Which of these take its price to R$ 230? Select all that apply.",
        "Um produto custa R$ 200. Quais destas opções levam o preço a R$ 230? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-factor-new-price-all",
    skill: "percent-factor",
  },
  {
    content: {
      question: t(
        "A price of R$ 100 goes through each change below. Put them in order, from the one that leaves the lowest price to the one that leaves the highest.",
        "Um preço de R$ 100 passa por cada mudança abaixo. Coloque-as em ordem, da que deixa o menor preço até a que deixa o maior.",
      ),
      reason: t(
        "The multipliers are 0.7, 0.9 × 0.9 = 0.81, 0.9, 1.1 × 0.9 = 0.99 and 1.05.",
        "Os fatores são 0,7, 0,9 × 0,9 = 0,81, 0,9, 1,1 × 0,9 = 0,99 e 1,05.",
      ),
      steps: [
        t("Drop 30%", "Cair 30%"),
        t("Drop 10% twice", "Cair 10% duas vezes"),
        t("Drop 10%", "Cair 10%"),
        t("Rise 10%, then drop 10%", "Subir 10% e depois cair 10%"),
        t("Rise 5%", "Subir 5%"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-factor-changes-order",
    skill: "percent-factor",
  },
  {
    content: {
      pairs: [
        { left: t("f(x) = 3x", "f(x) = 3x"), right: t("(1, 3) and (2, 6)", "(1, 3) e (2, 6)") },
        {
          left: t("f(x) = x + 3", "f(x) = x + 3"),
          right: t("(1, 4) and (2, 5)", "(1, 4) e (2, 5)"),
        },
        { left: t("f(x) = x²", "f(x) = x²"), right: t("(1, 1) and (2, 4)", "(1, 1) e (2, 4)") },
        {
          left: t("f(x) = 10 − x", "f(x) = 10 − x"),
          right: t("(1, 9) and (2, 8)", "(1, 9) e (2, 8)"),
        },
      ],
      question: t(
        "Match each rule with the two points (x, f(x)) of its graph.",
        "Ligue cada regra aos dois pontos (x, f(x)) do seu gráfico.",
      ),
      reason: t(
        "Put x = 1 and x = 2 into each rule: 3x gives 3 and 6, x + 3 gives 4 and 5, x² gives 1 and 4, and 10 − x gives 9 and 8.",
        "Coloque x = 1 e x = 2 em cada regra: 3x dá 3 e 6, x + 3 dá 4 e 5, x² dá 1 e 4, e 10 − x dá 9 e 8.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-functions-rule-points-match",
    skill: "function-representations",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("A 10 km ride costs R$ 25.", "Uma corrida de 10 km custa R$ 25."),
          t("P(10) = 5 + 2 × 10 = 25.", "P(10) = 5 + 2 × 10 = 25."),
        ),
        bankOption(
          t("Each extra km adds R$ 2 to the price.", "Cada km a mais soma R$ 2 ao preço."),
          t(
            "The rule grows by 2 each time x grows by 1.",
            "A regra aumenta 2 cada vez que x aumenta 1.",
          ),
        ),
        bankOption(
          t("x can't be negative here.", "Aqui, x não pode ser negativo."),
          t("x is a distance, so it starts at 0.", "x é uma distância, então começa em 0."),
        ),
        bankOption(
          t("A 10 km ride costs R$ 70.", "Uma corrida de 10 km custa R$ 70."),
          t(
            "The R$ 5 is paid once, not for every km: 5 + 2 × 10 = 25.",
            "Os R$ 5 são pagos uma vez, não a cada km: 5 + 2 × 10 = 25.",
          ),
          t(
            "Multiplied the start fee by the distance too",
            "Multiplicou também a bandeirada pela distância",
          ),
        ),
        bankOption(
          t(
            "The price doubles when the distance doubles.",
            "O preço dobra quando a distância dobra.",
          ),
          t(
            "2 km costs R$ 9 and 4 km costs R$ 13: the R$ 5 start fee breaks the proportion.",
            "2 km custam R$ 9 e 4 km custam R$ 13: a bandeirada de R$ 5 quebra a proporção.",
          ),
          t("Treated the function as proportional", "Tratou a função como proporcional"),
        ),
        bankOption(
          t("A 0 km ride costs nothing.", "Uma corrida de 0 km não custa nada."),
          t(
            "P(0) = 5: the start fee is paid anyway.",
            "P(0) = 5: a bandeirada é paga de qualquer jeito.",
          ),
          t("Forgot the fixed part of the rule", "Esqueceu a parte fixa da regra"),
        ),
      ],
      question: t(
        "A taxi charges P(x) = 5 + 2x reais, where x is the distance in km. Which statements are true? Select all that apply.",
        "Um táxi cobra P(x) = 5 + 2x reais, em que x é a distância em km. Quais afirmações são verdadeiras? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-functions-taxi-all",
    skill: "function-representations",
  },
  {
    content: {
      question: t(
        "For f(x) = x² − 4x, put these values in order, from smallest to largest.",
        "Para f(x) = x² − 4x, coloque estes valores em ordem, do menor para o maior.",
      ),
      reason: t(
        "f(2) = −4, f(1) = −3, f(0) = 0, f(5) = 5 and f(−2) = 12.",
        "f(2) = −4, f(1) = −3, f(0) = 0, f(5) = 5 e f(−2) = 12.",
      ),
      steps: [
        t("f(2)", "f(2)"),
        t("f(1)", "f(1)"),
        t("f(0)", "f(0)"),
        t("f(5)", "f(5)"),
        t("f(−2)", "f(−2)"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-functions-values-order",
    skill: "function-representations",
  },
  {
    content: {
      pairs: [
        { left: t("Acceleration", "Aceleração"), right: t("2 m/s²", "2 m/s²") },
        { left: t("Time", "Tempo"), right: t("5 s", "5 s") },
        { left: t("Final speed", "Velocidade final"), right: t("10 m/s", "10 m/s") },
        { left: t("Average speed", "Velocidade média"), right: t("5 m/s", "5 m/s") },
        { left: t("Distance covered", "Distância percorrida"), right: t("25 m", "25 m") },
      ],
      question: t(
        "A car starts from rest and speeds up at 2 m/s² for 5 s. Match each quantity with its value.",
        "Um carro parte do repouso e acelera a 2 m/s² durante 5 s. Ligue cada grandeza ao seu valor.",
      ),
      reason: t(
        "v = 2 × 5 = 10 m/s, the average of 0 and 10 is 5 m/s, and d = 5 m/s × 5 s = 25 m.",
        "v = 2 × 5 = 10 m/s, a média entre 0 e 10 é 5 m/s, e d = 5 m/s × 5 s = 25 m.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-motion-car-match",
    skill: "motion-problems",
  },
  {
    content: {
      question: t(
        "Put these trips in order, from the shortest distance to the longest.",
        "Coloque estes trajetos em ordem, da menor distância para a maior.",
      ),
      reason: t(
        "Distance is speed × time, in m/s and seconds: 600 m, 900 m, 1,200 m, 1,500 m and 2,400 m.",
        "A distância é velocidade × tempo, em m/s e segundos: 600 m, 900 m, 1.200 m, 1.500 m e 2.400 m.",
      ),
      steps: [
        t("5 m/s for 2 min", "5 m/s por 2 min"),
        t("54 km/h for 1 min", "54 km/h por 1 min"),
        t("10 m/s for 2 min", "10 m/s por 2 min"),
        t("90 km/h for 1 min", "90 km/h por 1 min"),
        t("4 m/s for 10 min", "4 m/s por 10 min"),
      ],
    },
    difficulty: 1,
    format: "order",
    key: "placement-motion-trips-order",
    skill: "motion-problems",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("She covers 60 m.", "Ela percorre 60 m."),
          t("d = 6 m/s × 10 s = 60 m.", "d = 6 m/s × 10 s = 60 m."),
        ),
        bankOption(
          t("She covers 6 m each second.", "Ela percorre 6 m a cada segundo."),
          t("That's what 6 m/s means.", "É isso que 6 m/s quer dizer."),
        ),
        bankOption(
          t("Her acceleration is zero.", "A aceleração dela é zero."),
          t(
            "Her speed doesn't change, so there's no acceleration.",
            "A velocidade não muda, então não há aceleração.",
          ),
        ),
        bankOption(
          t("Her acceleration is 6 m/s².", "A aceleração dela é 6 m/s²."),
          t(
            "6 m/s is her speed. A constant speed means no acceleration.",
            "6 m/s é a velocidade. Velocidade constante quer dizer aceleração zero.",
          ),
          t("Mixed up speed and acceleration", "Confundiu velocidade com aceleração"),
        ),
        bankOption(
          t(
            "Her speed grows by 6 m/s each second.",
            "A velocidade dela aumenta 6 m/s a cada segundo.",
          ),
          t("Her speed stays at 6 m/s the whole time.", "A velocidade fica em 6 m/s o tempo todo."),
          t("Read a constant speed as speeding up", "Leu velocidade constante como aceleração"),
        ),
        bankOption(
          t("She covers 16 m.", "Ela percorre 16 m."),
          t(
            "Speed and time are multiplied, not added: 6 × 10 = 60.",
            "Velocidade e tempo se multiplicam, não se somam: 6 × 10 = 60.",
          ),
          t("Added speed and time", "Somou velocidade e tempo"),
        ),
      ],
      question: t(
        "A cyclist rides at a constant 6 m/s for 10 s. Which statements are true? Select all that apply.",
        "Uma ciclista pedala a 6 m/s constantes durante 10 s. Quais afirmações são verdadeiras? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-motion-cyclist-all",
    skill: "motion-problems",
  },
  {
    content: {
      pairs: [
        { left: t("1 cm on the map", "1 cm no mapa"), right: t("500 m", "500 m") },
        { left: t("2 cm on the map", "2 cm no mapa"), right: t("1 km", "1 km") },
        { left: t("5 cm on the map", "5 cm no mapa"), right: t("2.5 km", "2,5 km") },
        { left: t("10 cm on the map", "10 cm no mapa"), right: t("5 km", "5 km") },
      ],
      question: t(
        "A map has a scale of 1:50,000. Match each distance on the map with the real distance.",
        "Um mapa tem escala 1:50.000. Ligue cada distância no mapa à distância real.",
      ),
      reason: t(
        "1 cm stands for 50,000 cm, which is 500 m, so multiply each length by 500 m.",
        "1 cm vale 50.000 cm, que são 500 m, então multiplique cada medida por 500 m.",
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-map-scale-match",
    skill: "map-scale-coordinates",
  },
  {
    content: {
      question: t(
        "You face north and turn clockwise. Put the directions in the order you face them.",
        "Você está de frente para o norte e gira no sentido horário. Coloque as direções na ordem em que você fica de frente para elas.",
      ),
      reason: t(
        "Clockwise from north you pass northeast, east, southeast and then south.",
        "No sentido horário, a partir do norte, você passa por nordeste, leste, sudeste e depois sul.",
      ),
      steps: [
        t("North", "Norte"),
        t("Northeast", "Nordeste"),
        t("East", "Leste"),
        t("Southeast", "Sudeste"),
        t("South", "Sul"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-map-directions-order",
    skill: "map-scale-coordinates",
  },
  {
    content: {
      context: null,
      fixedOrder: false,
      options: [
        bankOption(
          t("The Equator is at latitude 0°.", "A Linha do Equador fica na latitude 0°."),
          t("Latitude is counted from the Equator.", "A latitude é contada a partir do Equador."),
        ),
        bankOption(
          t(
            "Places south of the Equator have south latitudes.",
            "Lugares ao sul do Equador têm latitude sul.",
          ),
          t(
            "Latitude says how far north or south of the Equator a place is.",
            "A latitude diz quanto um lugar está ao norte ou ao sul do Equador.",
          ),
        ),
        bankOption(
          t(
            "Longitude is measured east or west of the Greenwich meridian.",
            "A longitude é medida a leste ou a oeste do meridiano de Greenwich.",
          ),
          t("Greenwich is longitude 0°.", "Greenwich é a longitude 0°."),
        ),
        bankOption(
          t("Latitude goes from 0° to 180°.", "A latitude vai de 0° a 180°."),
          t(
            "Latitude goes up to 90° north or south. It's longitude that reaches 180°.",
            "A latitude vai até 90° norte ou sul. É a longitude que chega a 180°.",
          ),
          t(
            "Mixed up the ranges of latitude and longitude",
            "Confundiu os intervalos de latitude e longitude",
          ),
        ),
        bankOption(
          t("Brasília is in the Northern Hemisphere.", "Brasília fica no Hemisfério Norte."),
          t(
            "Brasília is about 16° south of the Equator.",
            "Brasília fica a cerca de 16° ao sul do Equador.",
          ),
          t(
            "Placed Brazil's capital north of the Equator",
            "Pôs a capital do Brasil ao norte do Equador",
          ),
        ),
      ],
      question: t(
        "Which statements about latitude and longitude are true? Select all that apply.",
        "Quais afirmações sobre latitude e longitude são verdadeiras? Marque todas as certas.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-map-coordinates-all",
    skill: "map-scale-coordinates",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Most of it is used and given off as heat",
            "A maior parte é gasta e liberada como calor",
          ),
          t(
            "Each level spends most of its energy living, moving and keeping warm, so only about a tenth passes on.",
            "Cada nível gasta a maior parte da energia para viver, se mover e se aquecer, então só cerca de um décimo passa adiante.",
          ),
        ),
        bankOption(
          t(
            "It is stored and passed on to the next level",
            "Fica guardada e passa para o nível seguinte",
          ),
          t(
            "Only about 10% passes on; the rest doesn't reach the next level.",
            "Só cerca de 10% passa adiante; o resto não chega ao nível seguinte.",
          ),
          t(
            "Thinks most energy passes up the chain",
            "Acha que a maior parte da energia sobe na cadeia",
          ),
        ),
        bankOption(
          t("It goes back to the producers", "Volta para os produtores"),
          t(
            "Energy flows one way; producers get theirs from the Sun.",
            "A energia flui em um só sentido; os produtores recebem a deles do Sol.",
          ),
          t("Thinks energy cycles like matter", "Acha que a energia circula como a matéria"),
        ),
        bankOption(
          t("It turns into new matter", "Vira matéria nova"),
          t(
            "Only the small part that builds the body passes on; most is spent as heat.",
            "Só a pequena parte que forma o corpo passa adiante; a maior parte é gasta como calor.",
          ),
          t("Thinks energy becomes matter", "Acha que a energia vira matéria"),
        ),
      ],
      question: t(
        "Only about 10% of a level's energy reaches the next level of a food chain. What happens to most of the rest?",
        "Só cerca de 10% da energia de um nível chega ao nível seguinte de uma cadeia alimentar. O que acontece com a maior parte do resto?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-ten-percent-lost-energy",
    skill: "ten-percent-rule",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("About 600", "Cerca de 600"),
          t(
            "29 is about 30 and 21 is about 20: 30 × 20 = 600, and the exact 609 is close.",
            "29 é quase 30 e 21 é quase 20: 30 × 20 = 600, e o valor exato, 609, fica perto.",
          ),
        ),
        bankOption(
          t("About 60", "Cerca de 60"),
          t("30 × 20 is 600, ten times more.", "30 × 20 dá 600, dez vezes mais."),
          t("Lost a zero when rounding", "Perdeu um zero ao arredondar"),
        ),
        bankOption(
          t("About 6,000", "Cerca de 6.000"),
          t("30 × 20 is 600, not 6,000.", "30 × 20 dá 600, não 6.000."),
          t("Added a zero when rounding", "Acrescentou um zero ao arredondar"),
        ),
        bankOption(
          t("About 50", "Cerca de 50"),
          t(
            "50 is about 29 + 21; the question asks for 29 × 21.",
            "50 é mais ou menos 29 + 21; a pergunta pede 29 × 21.",
          ),
          t("Added instead of multiplying", "Somou em vez de multiplicar"),
        ),
      ],
      question: t(
        "A school bus makes a 29 km round trip every school day. About how far does it go in 21 school days?",
        "Um ônibus escolar faz um percurso de 29 km, ida e volta, todo dia de aula. Mais ou menos quanto ele roda em 21 dias de aula?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-estimate-bus-distance",
    skill: "estimate-numbers",
  },
  {
    content: {
      context: t(
        "A phone plan costs R$ 30 a month plus R$ 5 for each gigabyte used beyond the plan.",
        "Um plano de celular custa R$ 30 por mês mais R$ 5 por gigabyte usado além do plano.",
      ),
      options: [
        bankOption(
          t("C(g) = 30 + 5g", "C(g) = 30 + 5g"),
          t(
            "The R$ 30 is paid once a month, and each extra gigabyte adds R$ 5.",
            "Os R$ 30 são pagos uma vez por mês, e cada gigabyte extra soma R$ 5.",
          ),
        ),
        bankOption(
          t("C(g) = 35g", "C(g) = 35g"),
          t(
            "That charges R$ 35 per gigabyte and nothing when g is 0.",
            "Isso cobra R$ 35 por gigabyte e nada quando g é 0.",
          ),
          t("Added the fixed and the per-unit parts", "Somou a parte fixa com a parte por unidade"),
        ),
        bankOption(
          t("C(g) = 5 + 30g", "C(g) = 5 + 30g"),
          t(
            "The fixed part is R$ 30 and each gigabyte costs R$ 5, not the other way around.",
            "A parte fixa é R$ 30 e cada gigabyte custa R$ 5, não o contrário.",
          ),
          t("Swapped the fixed part and the rate", "Trocou a parte fixa pela taxa"),
        ),
        bankOption(
          t("C(g) = 5g", "C(g) = 5g"),
          t(
            "That leaves out the R$ 30 paid every month.",
            "Isso deixa de fora os R$ 30 pagos todo mês.",
          ),
          t("Forgot the monthly fee", "Esqueceu a mensalidade"),
        ),
      ],
      question: t(
        "Which rule gives the monthly cost C for g extra gigabytes?",
        "Qual regra dá o custo mensal C para g gigabytes extras?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-functions-phone-rule",
    skill: "function-representations",
  },
];
