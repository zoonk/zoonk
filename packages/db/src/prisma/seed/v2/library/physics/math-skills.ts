import { t } from "../../_utils/localize";
import { skill } from "../content";

/** The beginner band: the math physics uses, from fractions to vectors. */
export const mathSkills = [
  skill("fractions", "beginner", {
    description: t(
      "A fraction a/b means a divided by b: 3/4 = 0.75.",
      "Uma fração a/b quer dizer a dividido por b: 3/4 = 0,75.",
    ),
    name: t("Read a fraction as a division", "Ler uma fração como divisão"),
  }),
  skill(
    "percent-of",
    "beginner",
    {
      description: t(
        "To find p% of a number, multiply it by p/100: 20% of 50 is 0.2 × 50 = 10.",
        "Para achar p% de um número, multiplique por p/100: 20% de 50 é 0,2 × 50 = 10.",
      ),
      name: t("Find a percent of a number", "Calcular a porcentagem de um número"),
    },
    { prerequisites: ["fractions"] },
  ),
  skill("solve-linear", "beginner", {
    description: t(
      "Do the same thing to both sides until x is alone: 2x + 3 = 11 gives x = 4.",
      "Faça a mesma coisa dos dois lados até o x ficar sozinho: 2x + 3 = 11 dá x = 4.",
    ),
    name: t("Solve a linear equation", "Resolver uma equação do primeiro grau"),
  }),
  skill(
    "model-equation",
    "beginner",
    {
      description: t(
        "Name the unknown, then write what the problem says about it as an equation.",
        "Dê nome à incógnita e escreva como equação o que o problema diz sobre ela.",
      ),
      name: t("Turn a word problem into an equation", "Transformar um problema em equação"),
    },
    { prerequisites: ["solve-linear"] },
  ),
  skill("function-concept", "beginner", {
    description: t(
      "A function turns each input into exactly one output, like f(x) = 2x turning 3 into 6.",
      "Uma função transforma cada entrada em exatamente uma saída, como f(x) = 2x transforma 3 em 6.",
    ),
    name: t("Describe a function as input and output", "Descrever uma função como entrada e saída"),
  }),
  skill(
    "read-graph",
    "beginner",
    {
      description: t(
        "Find the input on the horizontal axis, go up to the line and read the output on the vertical axis.",
        "Ache a entrada no eixo horizontal, suba até a linha e leia a saída no eixo vertical.",
      ),
      name: t("Read values from a graph", "Ler valores em um gráfico"),
    },
    { prerequisites: ["function-concept"] },
  ),
  skill(
    "slope",
    "beginner",
    {
      description: t(
        "Slope is how much the output changes for each unit of input: rise over run.",
        "A inclinação é quanto a saída muda para cada unidade de entrada: subida sobre avanço.",
      ),
      name: t("Read slope as a rate of change", "Ler a inclinação como taxa de variação"),
    },
    { prerequisites: ["read-graph"] },
  ),
  skill("powers-of-ten", "beginner", {
    description: t(
      "10ⁿ is 1 followed by n zeros, and 10⁻ⁿ is 1 divided by that: 10³ = 1,000 and 10⁻³ = 0.001.",
      "10ⁿ é 1 seguido de n zeros, e 10⁻ⁿ é 1 dividido por isso: 10³ = 1.000 e 10⁻³ = 0,001.",
    ),
    example: t(
      "A millimeter is 10⁻³ m and a kilometer is 10³ m.",
      "Um milímetro é 10⁻³ m e um quilômetro é 10³ m.",
    ),
    name: t("Use powers of ten", "Usar potências de dez"),
  }),
  skill(
    "sci-notation",
    "beginner",
    {
      description: t(
        "Write a number as a number from 1 to 10 times a power of ten: 150,000,000,000 = 1.5 × 10¹¹.",
        "Escreva o número como um número de 1 a 10 vezes uma potência de dez: 150.000.000.000 = 1,5 × 10¹¹.",
      ),
      example: t(
        "The hydrogen atom's radius, 0.000000000053 m, is 5.3 × 10⁻¹¹ m.",
        "O raio do átomo de hidrogênio, 0,000000000053 m, é 5,3 × 10⁻¹¹ m.",
      ),
      name: t("Write a number in scientific notation", "Escrever um número em notação científica"),
      useCase: t(
        "Physicists write every size, from atoms to galaxies, in a few characters.",
        "Físicos escrevem qualquer tamanho, de átomos a galáxias, com poucos caracteres.",
      ),
    },
    { hard: true, prerequisites: ["powers-of-ten"] },
  ),
  skill(
    "orders-of-magnitude",
    "beginner",
    {
      description: t(
        "Compare the powers first: each step up in the power makes a number ten times bigger.",
        "Compare primeiro as potências: cada degrau a mais na potência deixa o número dez vezes maior.",
      ),
      example: t(
        "3 × 10⁸ is more than three times 9 × 10⁷, even though 3 is smaller than 9.",
        "3 × 10⁸ é mais que o triplo de 9 × 10⁷, mesmo 3 sendo menor que 9.",
      ),
      name: t("Compare numbers by their powers of ten", "Comparar números pelas potências de dez"),
      useCase: t(
        "Scientists check an answer by its order of magnitude before looking at its digits.",
        "Cientistas conferem uma resposta pela ordem de grandeza antes de olhar os dígitos.",
      ),
    },
    { prerequisites: ["sci-notation"] },
  ),
  skill(
    "sci-operations",
    "beginner",
    {
      description: t(
        "Multiply the front numbers and add the powers; divide them and subtract the powers.",
        "Multiplique os números da frente e some as potências; divida-os e subtraia as potências.",
      ),
      name: t(
        "Multiply and divide in scientific notation",
        "Multiplicar e dividir em notação científica",
      ),
    },
    { prerequisites: ["sci-notation"] },
  ),
  skill("vector-concept", "beginner", {
    description: t(
      "A vector has a size and a direction, drawn as an arrow, like 5 m/s to the north.",
      "Um vetor tem tamanho e direção, desenhado como uma seta, como 5 m/s para o norte.",
    ),
    name: t("Describe a vector", "Descrever um vetor"),
  }),
  skill(
    "vector-add",
    "beginner",
    {
      description: t(
        "Place the arrows tip to tail: the sum goes from the first tail to the last tip.",
        "Coloque as setas ponta com cauda: a soma vai da primeira cauda até a última ponta.",
      ),
      name: t("Add vectors", "Somar vetores"),
    },
    { prerequisites: ["vector-concept"] },
  ),
];
