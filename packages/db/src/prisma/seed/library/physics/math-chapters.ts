import { t } from "../../_utils/localize";
import { outlineLesson, withPractice } from "../content";
import { type SeedChapter } from "../types";
import { scientificNotationLesson } from "./lessons/scientific-notation";

export const mathChapters: SeedChapter[] = [
  {
    description: t(
      "Fractions as divisions and percents as fractions of 100.",
      "Frações como divisões e porcentagens como frações de 100.",
    ),
    key: "fractions-percentages",
    lessons: [
      outlineLesson(
        "fractions-as-division",
        {
          description: t("3/4 is just 3 divided by 4.", "3/4 é só 3 dividido por 4."),
          title: t("A fraction is a division", "Fração é divisão"),
        },
        ["fractions"],
      ),
      outlineLesson(
        "percent-of",
        {
          description: t(
            "Twenty percent of anything, in one multiplication.",
            "Vinte por cento de qualquer coisa, numa multiplicação.",
          ),
          title: t("Finding a percent of a number", "Porcentagem de um número"),
        },
        ["percent-of"],
      ),
    ],
    level: "beginner",
    objectives: [
      t("Read fractions as divisions", "Ler frações como divisões"),
      t("Find a percent of a number", "Calcular a porcentagem de um número"),
    ],
    title: t("Fractions and percentages", "Frações e porcentagens"),
  },
  {
    description: t(
      "Solving for an unknown by keeping both sides balanced.",
      "Achar uma incógnita mantendo os dois lados em equilíbrio.",
    ),
    key: "linear-equations",
    lessons: [
      outlineLesson(
        "balance-both-sides",
        {
          description: t(
            "Whatever you do to one side, do to the other.",
            "O que você fizer de um lado, faça do outro.",
          ),
          title: t("Keep both sides balanced", "Mantenha os dois lados em equilíbrio"),
        },
        ["solve-linear"],
      ),
      outlineLesson(
        "equations-from-words",
        {
          description: t(
            "Turn a sentence into an equation you can solve.",
            "Transforme uma frase numa equação que você consegue resolver.",
          ),
          title: t("From words to equations", "Das palavras à equação"),
        },
        ["model-equation"],
        5,
      ),
    ],
    level: "beginner",
    objectives: [
      t("Solve linear equations", "Resolver equações do primeiro grau"),
      t("Write equations from word problems", "Escrever equações a partir de problemas"),
    ],
    title: t("Linear equations", "Equações do primeiro grau"),
  },
  {
    description: t(
      "Functions as machines, and the graphs that show them.",
      "Funções como máquinas, e os gráficos que as mostram.",
    ),
    key: "functions-graphs",
    lessons: [
      withPractice(
        outlineLesson(
          "function-machine",
          {
            description: t(
              "Put a number in, get exactly one number out.",
              "Entra um número, sai exatamente um número.",
            ),
            title: t("A function is a machine", "Função é uma máquina"),
          },
          ["function-concept"],
        ),
        {
          answer: t("13", "13"),
          correction: t(
            "Fifteen comes from tripling 4 + 1. The machine triples the input first.",
            "Quinze é o triplo de 4 + 1. A máquina primeiro triplica a entrada.",
          ),
          distractor: t("15", "15"),
          example: t(
            "A machine triples its input and adds one. Put in 2 and it returns 7 because 3 × 2 + 1 = 7.",
            "Uma máquina triplica a entrada e soma um. Ao receber 2, devolve 7, pois 3 × 2 + 1 = 7.",
          ),
          question: t("What does it return for 4?", "O que ela devolve para a entrada 4?"),
          reason: t(
            "Apply the same rule to the new input. Three times four plus one is thirteen.",
            "Aplique a mesma regra à nova entrada. Três vezes quatro mais um dá treze.",
          ),
          takeaway: t(
            "A function applies the same rule each time you give it an input.",
            "Uma função aplica a mesma regra sempre que recebe uma entrada.",
          ),
        },
      ),
      withPractice(
        outlineLesson(
          "reading-graphs",
          {
            description: t(
              "Find any value on a graph in two moves.",
              "Ache qualquer valor num gráfico em dois movimentos.",
            ),
            title: t("Reading a graph", "Lendo um gráfico"),
          },
          ["read-graph"],
        ),
        {
          answer: t("23 degrees", "23 graus"),
          correction: t(
            "Twelve locates noon on the horizontal axis. Read the vertical coordinate for the temperature.",
            "Doze marca o meio-dia no eixo horizontal. Leia a coordenada vertical para achar a temperatura.",
          ),
          distractor: t("12 degrees", "12 graus"),
          example: t(
            "On a temperature graph, time runs across the bottom and degrees run up the side. A point at (9, 18) means it was 18 degrees at 9 o’clock.",
            "Num gráfico de temperatura, as horas ficam no eixo horizontal e os graus no vertical. O ponto (9, 18) indica que fazia 18 graus às 9 horas.",
          ),
          question: t(
            "What temperature does the point (12, 23) show at noon?",
            "Qual temperatura o ponto (12, 23) indica ao meio-dia?",
          ),
          reason: t(
            "The first coordinate locates the time. The second gives the temperature.",
            "A primeira coordenada indica a hora. A segunda dá a temperatura.",
          ),
          takeaway: t(
            "Read the axis labels to tell what each coordinate measures.",
            "Leia os rótulos dos eixos para saber o que cada coordenada mede.",
          ),
        },
      ),
      withPractice(
        outlineLesson(
          "slope-is-a-rate",
          {
            description: t(
              "How steep a line is tells you how fast something changes.",
              "A inclinação de uma reta diz a rapidez com que algo muda.",
            ),
            title: t("Slope is a rate", "Inclinação é taxa"),
          },
          ["slope"],
          5,
        ),
        {
          answer: t("2 liters per minute", "2 litros por minuto"),
          correction: t(
            "Four is the time in minutes. The slope measures how much volume is added in each minute.",
            "Quatro é o tempo em minutos. A inclinação mede quanto volume entra a cada minuto.",
          ),
          distractor: t("4 liters per minute", "4 litros por minuto"),
          example: t(
            "A tank gains 6 liters in 2 minutes at a steady pace. On a graph of volume against time, its slope is 6 ÷ 2 = 3 liters per minute.",
            "Um tanque ganha 6 litros em 2 minutos a um ritmo constante. Num gráfico de volume por tempo, a inclinação é 6 ÷ 2 = 3 litros por minuto.",
          ),
          question: t(
            "Another tank gains 8 liters in 4 minutes. What is its slope?",
            "Outro tanque ganha 8 litros em 4 minutos. Qual é a inclinação?",
          ),
          reason: t(
            "Divide the change in volume by the time it took. Eight divided by four is two.",
            "Divida a variação do volume pelo tempo que passou. Oito dividido por quatro dá dois.",
          ),
          takeaway: t(
            "Slope is the change on the vertical axis divided by the change on the horizontal axis.",
            "A inclinação é a variação no eixo vertical dividida pela variação no eixo horizontal.",
          ),
        },
      ),
    ],
    level: "beginner",
    objectives: [
      t("Describe a function as input and output", "Descrever uma função como entrada e saída"),
      t("Read graphs and their slopes", "Ler gráficos e suas inclinações"),
    ],
    title: t("Functions and graphs", "Funções e gráficos"),
  },
  {
    description: t(
      "Powers of ten and the notation physics uses for atoms and stars alike.",
      "Potências de dez e a notação que a física usa tanto para átomos quanto para estrelas.",
    ),
    key: "exponents-scientific-notation",
    lessons: [
      withPractice(
        outlineLesson(
          "powers-of-ten",
          {
            description: t(
              "A 1 and some zeros, or a 1 divided by them.",
              "Um 1 e alguns zeros, ou um 1 dividido por eles.",
            ),
            title: t("Powers of ten", "Potências de dez"),
          },
          ["powers-of-ten"],
        ),
        {
          answer: t("10,000", "10.000"),
          correction: t(
            "The exponent counts factors of ten. It does not multiply the result by four.",
            "O expoente conta fatores dez. Ele não multiplica o resultado por quatro.",
          ),
          distractor: t("4,000", "4.000"),
          example: t(
            "Start at 1 and multiply by 10 three times. You get 10, then 100, then 1,000. That last number is 10³.",
            "Comece no 1 e multiplique por 10 três vezes. Você chega a 10, depois a 100 e a 1.000. Esse último número é 10³.",
          ),
          question: t("What is 10⁴?", "Quanto vale 10⁴?"),
          reason: t(
            "One more factor of ten takes one thousand to ten thousand.",
            "Mais um fator dez leva de mil a dez mil.",
          ),
          takeaway: t(
            "Increasing the exponent of ten by one multiplies the value by ten.",
            "Aumentar o expoente de dez em um multiplica o valor por dez.",
          ),
        },
      ),
      scientificNotationLesson,
      outlineLesson(
        "multiply-divide-powers",
        {
          description: t(
            "Add the powers to multiply, subtract them to divide.",
            "Some as potências para multiplicar, subtraia para dividir.",
          ),
          title: t(
            "Multiplying and dividing powers of ten",
            "Multiplicando e dividindo potências de dez",
          ),
        },
        ["sci-operations"],
        5,
      ),
    ],
    level: "beginner",
    objectives: [
      t("Write numbers in scientific notation", "Escrever números em notação científica"),
      t("Compare and combine powers of ten", "Comparar e combinar potências de dez"),
    ],
    title: t("Exponents and scientific notation", "Potências e notação científica"),
  },
  {
    description: t(
      "Quantities with a size and a direction, like velocity and force.",
      "Grandezas com tamanho e direção, como velocidade e força.",
    ),
    key: "vectors",
    lessons: [
      outlineLesson(
        "arrows-with-size",
        {
          description: t(
            "Why 5 m/s north isn't the same as 5 m/s east.",
            "Por que 5 m/s para o norte não é o mesmo que 5 m/s para o leste.",
          ),
          title: t("Arrows with size and direction", "Setas com tamanho e direção"),
        },
        ["vector-concept"],
      ),
      outlineLesson(
        "adding-vectors",
        {
          description: t(
            "Tip to tail: how pushes and speeds combine.",
            "Ponta com cauda: como empurrões e velocidades se combinam.",
          ),
          title: t("Adding vectors", "Somando vetores"),
        },
        ["vector-add"],
        5,
      ),
    ],
    level: "beginner",
    objectives: [t("Describe and add vectors", "Descrever e somar vetores")],
    title: t("Vectors", "Vetores"),
    tools: [
      {
        essential: true,
        name: t(
          "Graphing calculator (Desmos or GeoGebra)",
          "Calculadora gráfica (Desmos ou GeoGebra)",
        ),
      },
    ],
  },
];
