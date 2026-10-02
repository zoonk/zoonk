import { t } from "../../_utils/localize";
import { outlineLesson } from "../content";
import { type SeedChapter } from "../types";
import { scientificNotationLesson } from "./lessons/scientific-notation";

/** The beginner band: the math physics uses, which a from-scratch plan starts with. */
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
