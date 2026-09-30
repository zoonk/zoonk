import { type TestCase } from "@/lib/types";
import { type CoverageCheckParams } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { type CoverageCheckExpected } from "./scorer";

type CoverageSkill = CoverageCheckParams["skills"][number];

function skill(key: string, name: string, description = `${name}.`): CoverageSkill {
  return { description, key, name };
}

function weighted(key: string, name: string, examWeight: number): CoverageSkill {
  return { ...skill(key, name), examWeight };
}

export const TEST_CASES: TestCase<CoverageCheckExpected, CoverageCheckParams>[] = [
  {
    expected: {
      gaps: [
        "Geometria espacial: volumes de prismas, cilindros, cones e esferas",
        "Análise combinatória: princípio fundamental da contagem",
        "Probabilidade de eventos simples",
      ],
    },
    id: "pt-enem-matematica-planted-gaps",
    userInput: {
      goal: "Passar no ENEM 2026",
      goalKind: "exam",
      language: "pt",
      references: [
        {
          text: [
            "Números: operações com inteiros, frações e decimais",
            "Porcentagem e juros simples e compostos",
            "Razão, proporção e regra de três",
            "Leitura e interpretação de gráficos e tabelas",
            "Medidas de tendência central: média, mediana e moda",
            "Funções do primeiro e do segundo grau",
            "Geometria plana: áreas e perímetros",
            "Geometria espacial: volumes de prismas, cilindros, cones e esferas",
            "Análise combinatória: princípio fundamental da contagem",
            "Probabilidade de eventos simples",
            "Trigonometria no triângulo retângulo",
            "Inscrições e taxa de inscrição: consulte o edital",
          ].join("\n"),
          title: "Matemática e suas Tecnologias: conteúdos",
        },
      ],
      skills: [
        skill("operacoes", "Operar com inteiros, frações e decimais"),
        skill("porcentagem", "Calcular porcentagens"),
        skill("juros", "Calcular juros simples e compostos"),
        skill("proporcao", "Resolver problemas de razão e proporção"),
        skill("graficos", "Interpretar gráficos e tabelas"),
        skill("media", "Calcular média, mediana e moda"),
        skill("funcoes", "Usar funções do primeiro e do segundo grau"),
        skill("areas", "Calcular áreas e perímetros de figuras planas"),
        skill("trigonometria", "Usar seno, cosseno e tangente no triângulo retângulo"),
      ],
    },
  },
  {
    expected: {
      gaps: [
        "Week 7: Sampling distributions and the central limit theorem",
        "Week 10: Chi-square tests for categorical data",
      ],
    },
    id: "en-intro-stats-syllabus",
    userInput: {
      goal: "Learn introductory statistics at a university level",
      goalKind: "learn",
      language: "en",
      references: [
        {
          text: [
            "Week 1: Types of data and sampling methods",
            "Week 2: Graphs for categorical and numerical data",
            "Week 3: Measures of center and spread",
            "Week 4: The normal distribution and z-scores",
            "Week 5: Correlation and simple linear regression",
            "Week 6: Probability rules",
            "Week 7: Sampling distributions and the central limit theorem",
            "Week 8: Confidence intervals for a mean and a proportion",
            "Week 9: Hypothesis tests and p-values",
            "Week 10: Chi-square tests for categorical data",
            "Grading: homework 30%, midterm 30%, final exam 40%",
            "Office hours: Tuesdays from 2 to 4 pm",
          ].join("\n"),
          title: "STAT 101: Introduction to Statistics",
        },
      ],
      skills: [
        skill("data-types", "Classify data and choose a sampling method"),
        skill("charts", "Choose and read charts for a data set"),
        skill("center-spread", "Summarize data with center and spread"),
        skill("normal", "Use the normal distribution and z-scores"),
        skill("regression", "Fit and read a simple linear regression"),
        skill("probability", "Apply basic probability rules"),
        skill("confidence-intervals", "Build a confidence interval"),
        skill("hypothesis-tests", "Run a hypothesis test and read a p-value"),
      ],
    },
  },
  {
    expected: {
      gaps: [
        "Angular momentum and spin",
        "Time-independent perturbation theory",
        "Identical particles and the Pauli exclusion principle",
        "Scattering theory",
      ],
    },
    id: "en-quantum-mechanics-two-syllabi",
    userInput: {
      goal: "Master quantum physics from scratch",
      goalKind: "learn",
      language: "en",
      references: [
        {
          text: [
            "Wave functions and the Born rule",
            "The time-independent Schrödinger equation",
            "Infinite square well and harmonic oscillator",
            "Operators, observables and commutators",
            "The uncertainty principle",
            "Angular momentum and spin",
            "The hydrogen atom",
          ].join("\n"),
          title: "PHYS 341: Quantum Mechanics I",
        },
        {
          text: [
            "Time-independent perturbation theory",
            "Identical particles and the Pauli exclusion principle",
            "Entanglement and Bell's inequalities",
            "Scattering theory",
          ].join("\n"),
          title: "PHYS 342: Quantum Mechanics II",
        },
      ],
      skills: [
        skill("wave-function", "Interpret a wave function with the Born rule"),
        skill("schrodinger", "Solve the time-independent Schrödinger equation"),
        skill("square-well", "Solve the infinite square well"),
        skill("oscillator", "Solve the quantum harmonic oscillator"),
        skill("operators", "Use operators, observables and commutators"),
        skill("uncertainty", "Apply the uncertainty principle"),
        skill("hydrogen", "Describe the hydrogen atom's energy levels"),
        skill("entanglement", "Explain entanglement and Bell's inequalities"),
      ],
    },
  },
  {
    expected: { gaps: [] },
    id: "es-python-no-gaps",
    userInput: {
      goal: "Aprender a programar en Python",
      goalKind: "learn",
      language: "es",
      references: [
        {
          text: [
            "Tema 1: Variables y tipos de datos",
            "Tema 2: Condicionales",
            "Tema 3: Bucles for y while",
            "Tema 4: Funciones",
            "Tema 5: Listas y diccionarios",
            "Tema 6: Lectura y escritura de ficheros",
            "Tema 7: Gestión de errores y excepciones",
            "Tema 8: Módulos y paquetes",
            "Evaluación: examen final 60%, prácticas 40%",
          ].join("\n"),
          title: "Curso de Python: temario",
        },
      ],
      skills: [
        skill("variables", "Guardar datos en variables de distintos tipos"),
        skill("condicionales", "Tomar decisiones con if, elif y else"),
        skill("bucles", "Repetir tareas con bucles for y while"),
        skill("funciones", "Escribir y llamar a funciones"),
        skill("colecciones", "Organizar datos en listas y diccionarios"),
        skill("ficheros", "Leer y escribir ficheros de texto"),
        skill("errores", "Capturar y gestionar excepciones"),
        skill("modulos", "Importar módulos e instalar paquetes"),
      ],
    },
  },
  {
    // A plan built before research read the notice: algebra, a heavy and frequent area, was
    // weighted as a prerequisite, and nothing teaches the expression of ideas.
    expected: {
      examWeights: [{ key: "linear-equations", max: 5, min: 4 }],
      gapWeights: [{ max: 4, min: 2 }],
      gaps: ["Expression of ideas"],
    },
    id: "en-sat-blueprint-weights",
    userInput: {
      goal: "Pass the SAT in March",
      goalKind: "exam",
      language: "en",
      references: [
        {
          text: [
            "EXAM: SAT",
            "SUBJECTS:",
            "- Reading and Writing (weight 50%): Craft and structure; Information and ideas; Standard English conventions; Expression of ideas",
            "- Math (weight 50%): Algebra; Advanced math; Problem-solving and data analysis; Geometry and trigonometry",
            "TOPIC_FREQUENCY:",
            "- Math / Algebra: high",
            "- Math / Advanced math: high",
            "- Math / Problem-solving and data analysis: medium",
            "- Math / Geometry and trigonometry: low",
            "- Reading and Writing / Standard English conventions: high",
            "- Reading and Writing / Information and ideas: medium",
            "- Reading and Writing / Craft and structure: medium",
            "- Reading and Writing / Expression of ideas: medium",
          ].join("\n"),
          title: "SAT",
        },
      ],
      skills: [
        weighted("linear-equations", "Solve linear equations, inequalities and systems", 1),
        weighted("nonlinear", "Solve quadratic, exponential and other nonlinear equations", 5),
        weighted(
          "data-analysis",
          "Interpret ratios, percentages, probability and data displays",
          3,
        ),
        weighted("geometry", "Find areas, volumes, circle measures and right-triangle ratios", 2),
        weighted("conventions", "Apply standard English grammar, usage and punctuation", 5),
        weighted("central-ideas", "Find central ideas, inferences and supporting evidence", 3),
        weighted(
          "words-in-context",
          "Determine a word's meaning and a text's structure and purpose",
          3,
        ),
      ],
    },
  },
];
