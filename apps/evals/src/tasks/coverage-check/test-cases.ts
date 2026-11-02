import { type TestCase } from "@/lib/types";
import { type CoverageCheckParams } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { type CoverageCheckExpected } from "./scorer";

type CoverageSkill = CoverageCheckParams["skills"][number];

function skill(key: string, name: string, description = `${name}.`): CoverageSkill {
  return { description, key, name };
}

function weighted(key: string, name: string, examWeight: number): CoverageSkill {
  return { ...skill(key, name), examWeight };
}

function placed({
  area,
  examWeight,
  key,
  name,
  topics,
}: {
  area: string;
  examWeight: number;
  key: string;
  name: string;
  topics: string[];
}): CoverageSkill {
  return { ...weighted(key, name, examWeight), area, topics };
}

const CAMARA_SUBJECTS = { politics: "Ciência Política", portuguese: "Língua Portuguesa" };

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
  {
    expected: {
      gaps: ["5 Sistemas eleitorais"],
      placements: [
        { key: "crase", topics: ["5.7 Emprego do sinal indicativo de crase"] },
        { key: "concordancia", topics: ["5.5 Concordância verbal e nominal"] },
      ],
    },
    id: "pt-camara-notice-topics",
    userInput: {
      examOutline: {
        name: "Concurso da Câmara dos Deputados, Analista Legislativo",
        notes: ["Scoring: cada item errado anula um item certo"],
        subjects: [
          {
            group: "Conhecimentos básicos (P1)",
            name: CAMARA_SUBJECTS.portuguese,
            questions: null,
            topics: [
              "1 Compreensão e interpretação de textos de gêneros variados",
              "3 Domínio da ortografia",
              "5 Domínio da estrutura morfossintática do período",
              "5.5 Concordância verbal e nominal",
              "5.7 Emprego do sinal indicativo de crase",
            ],
            weight: null,
          },
          {
            group: "Conhecimentos específicos (P2)",
            name: CAMARA_SUBJECTS.politics,
            questions: null,
            topics: [
              "1 Regimes políticos",
              "2 Sistemas e formas de governo",
              "5 Sistemas eleitorais",
            ],
            weight: null,
          },
        ],
        topicFrequency: [],
      },
      goal: "quero passar no concurso da câmara dos deputados para analista legislativo",
      goalKind: "exam",
      language: "pt",
      references: [],
      skills: [
        placed({
          area: CAMARA_SUBJECTS.portuguese,
          examWeight: 4,
          key: "leitura",
          name: "Interpretar textos de gêneros variados",
          topics: ["1 Compreensão e interpretação de textos de gêneros variados"],
        }),
        placed({
          area: CAMARA_SUBJECTS.portuguese,
          examWeight: 3,
          key: "ortografia",
          name: "Aplicar as regras de ortografia",
          topics: ["3 Domínio da ortografia"],
        }),
        placed({
          area: CAMARA_SUBJECTS.portuguese,
          examWeight: 4,
          key: "crase",
          name: "Empregar o acento grave indicativo de crase",
          topics: [],
        }),
        placed({
          area: CAMARA_SUBJECTS.portuguese,
          examWeight: 4,
          key: "concordancia",
          name: "Fazer a concordância do verbo e do nome",
          topics: [],
        }),
        placed({
          area: CAMARA_SUBJECTS.politics,
          examWeight: 3,
          key: "regimes",
          name: "Comparar regimes políticos",
          topics: ["1 Regimes políticos"],
        }),
        placed({
          area: CAMARA_SUBJECTS.politics,
          examWeight: 3,
          key: "governo",
          name: "Distinguir sistemas e formas de governo",
          topics: ["2 Sistemas e formas de governo"],
        }),
      ],
    },
  },
  {
    expected: { gaps: ["第6回：標本分布と中心極限定理", "第9回：カイ二乗検定"] },
    id: "ja-intro-stats-syllabus",
    userInput: {
      goal: "大学の統計学入門の単位を取る",
      goalKind: "learn",
      language: "ja",
      references: [
        {
          text: [
            "第1回：データの種類と標本調査",
            "第2回：度数分布表とヒストグラム",
            "第3回：平均・分散・標準偏差",
            "第4回：正規分布と標準化",
            "第5回：相関と単回帰",
            "第6回：標本分布と中心極限定理",
            "第7回：母平均の区間推定",
            "第8回：仮説検定とp値",
            "第9回：カイ二乗検定",
            "成績評価：レポート40%、期末試験60%",
          ].join("\n"),
          title: "統計学入門（シラバス）",
        },
      ],
      skills: [
        skill("data-types", "データの種類を見分け、標本調査の方法を選べる"),
        skill("histogram", "度数分布表とヒストグラムを作れる"),
        skill("spread", "平均と標準偏差でデータを要約できる"),
        skill("normal", "正規分布で確率を求められる"),
        skill("regression", "相関係数と回帰直線を読み取れる"),
        skill("intervals", "母平均の信頼区間を求められる"),
        skill("tests", "仮説検定を行いp値を読み取れる"),
      ],
    },
  },
  {
    expected: { gaps: ["7주차: 딕셔너리와 집합", "10주차: 예외 처리"] },
    id: "ko-python-syllabus",
    userInput: {
      goal: "교양 파이썬 수업에서 좋은 학점 받기",
      goalKind: "learn",
      language: "ko",
      references: [
        {
          text: [
            "1주차: 파이썬 설치와 첫 프로그램",
            "2주차: 변수와 자료형",
            "3주차: 조건문",
            "4주차: 반복문",
            "5주차: 함수",
            "6주차: 리스트와 튜플",
            "7주차: 딕셔너리와 집합",
            "8주차: 중간고사",
            "9주차: 파일 읽고 쓰기",
            "10주차: 예외 처리",
            "평가: 과제 30%, 중간고사 30%, 기말고사 40%",
          ].join("\n"),
          title: "컴퓨팅 사고와 파이썬",
        },
      ],
      skills: [
        skill("setup", "파이썬을 설치하고 첫 프로그램을 실행할 수 있어요"),
        skill("variables", "변수와 자료형을 다룰 수 있어요"),
        skill("conditions", "조건문으로 분기를 만들 수 있어요"),
        skill("loops", "반복문으로 같은 작업을 되풀이할 수 있어요"),
        skill("functions", "함수를 만들고 호출할 수 있어요"),
        skill("lists", "리스트와 튜플을 다룰 수 있어요"),
        skill("files", "파일을 읽고 쓸 수 있어요"),
      ],
    },
  },
  {
    expected: { gaps: ["5. Hafta: Kâr ve zarar hesapları", "8. Hafta: Bileşik faiz"] },
    id: "tr-business-math-syllabus",
    userInput: {
      goal: "Ticari matematik dersini geçmek",
      goalKind: "learn",
      language: "tr",
      references: [
        {
          text: [
            "1. Hafta: Oran ve orantı",
            "2. Hafta: Yüzde hesapları",
            "3. Hafta: KDV dahil ve hariç fiyatlar",
            "4. Hafta: İskonto",
            "5. Hafta: Kâr ve zarar hesapları",
            "6. Hafta: Basit faiz",
            "7. Hafta: Ara sınav",
            "8. Hafta: Bileşik faiz",
            "9. Hafta: Taksitli ödemeler",
            "Değerlendirme: ara sınav %40, final %60",
          ].join("\n"),
          title: "Ticari Matematik",
        },
      ],
      skills: [
        skill("ratios", "Oran ve orantı problemlerini çözmek"),
        skill("percent", "Yüzde hesaplamak"),
        skill("vat", "KDV dahil ve hariç fiyatı bulmak"),
        skill("discount", "İskontolu fiyatı hesaplamak"),
        skill("simple-interest", "Basit faizi hesaplamak"),
        skill("installments", "Taksitli ödemenin toplam maliyetini bulmak"),
      ],
    },
  },
];
