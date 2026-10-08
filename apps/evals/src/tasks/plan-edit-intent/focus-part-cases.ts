import { type TestCase } from "@/lib/types";
import { type PlanEditInput } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type PlanEditExpected } from "./scorer";

type PlanEditTestCase = TestCase<PlanEditExpected, PlanEditInput>;

/** A Monday, so "next week" starts on 2026-10-05. */
const TODAY = "2026-09-28";

const NATUREZA = "Ciências da Natureza e suas Tecnologias";
const HUMANAS = "Ciências Humanas e suas Tecnologias";
const MATEMATICA = "Matemática e suas Tecnologias";

/** Each discipline's skills of an ENEM plan, as its skill graph names them. */
const DISCIPLINES = {
  biologia: [
    ["bio-cells", "Relacionar células, tecidos e funções"],
    ["bio-dna", "Relacionar DNA, reprodução e herança"],
    ["bio-ecology", "Analisar fluxos de energia nos ecossistemas"],
    ["bio-evolution", "Comparar evidências e mecanismos evolutivos"],
  ],
  filosofia: [["phil-ethics", "Comparar correntes éticas e políticas"]],
  fisica: [
    ["phys-motion", "Analisar movimentos e seus gráficos"],
    ["phys-circuits", "Analisar circuitos e consumo elétrico"],
    ["phys-waves", "Comparar ondas, som e radiação"],
  ],
  geografia: [
    ["geo-maps", "Interpretar elementos de mapas"],
    ["geo-climate", "Relacionar climas e domínios naturais"],
  ],
  historia: [
    ["hist-republic", "Explicar a Primeira República brasileira"],
    ["hist-vargas", "Relacionar Era Vargas, Estado e trabalho"],
    ["hist-colony", "Relacionar colonização e escravidão à sociedade"],
  ],
  math: [["math-percent", "Calcular porcentagens e variações"]],
  quimica: [
    ["chem-reactions", "Reconhecer transformações químicas"],
    ["chem-organic", "Relacionar estruturas orgânicas e propriedades"],
    ["chem-equilibrium", "Prever alterações no equilíbrio químico"],
  ],
} as const;

type Discipline = keyof typeof DISCIPLINES;

const AREA_OF: Record<Discipline, string> = {
  biologia: NATUREZA,
  filosofia: HUMANAS,
  fisica: NATUREZA,
  geografia: HUMANAS,
  historia: HUMANAS,
  math: MATEMATICA,
  quimica: NATUREZA,
};

/** The skills interleaved across disciplines, as a graph lists them by phase. */
const SKILLS = (
  ["biologia", "fisica", "quimica", "historia", "geografia", "filosofia", "math"] as const
)
  .flatMap((discipline) =>
    DISCIPLINES[discipline].map(([skillId, name]) => ({
      area: AREA_OF[discipline],
      name,
      skillId,
    })),
  )
  .toSorted((a, b) => a.skillId.localeCompare(b.skillId));

function idsOf(...disciplines: Discipline[]): string[] {
  return disciplines.flatMap((discipline) => DISCIPLINES[discipline].map(([skillId]) => skillId));
}

function enemInput(request: string): PlanEditInput {
  return {
    areas: [MATEMATICA, NATUREZA, HUMANAS],
    dailyMinutes: 180,
    goalKind: "exam",
    language: "pt",
    request,
    skills: SKILLS,
    targetDate: "2026-11-08",
    today: TODAY,
    weekdayMinutes: [180, 180, 180, 180, 180, 180, 180],
  };
}

/**
 * Focus on part of an area: ENEM's Ciências da Natureza holds biology, chemistry and physics, and
 * its Ciências Humanas history, geography, philosophy and sociology. A learner who names some
 * disciplines gets those skills, every one and no other; one who names a whole area gets no part.
 */
export const FOCUS_PART_TEST_CASES: PlanEditTestCase[] = [
  {
    expected: {
      changes: [
        {
          areas: [NATUREZA],
          kind: "focusAreas",
          parts: [{ area: NATUREZA, skillIds: idsOf("biologia", "quimica") }],
        },
      ],
    },
    id: "pt-focus-part-biologia-quimica",
    userInput: enemInput(
      "Mais biologia e química em Ciências da Natureza: quero medicina e preciso delas",
    ),
  },
  {
    expected: {
      changes: [
        {
          areas: [HUMANAS],
          kind: "focusAreas",
          parts: [{ area: HUMANAS, skillIds: idsOf("historia") }],
        },
      ],
    },
    id: "pt-focus-part-historia",
    userInput: enemInput("quero estudar mais história, é o que mais cai pra mim em humanas"),
  },
  {
    expected: { changes: [{ areas: [NATUREZA], kind: "focusAreas", parts: [] }] },
    id: "pt-focus-whole-natureza",
    userInput: enemInput("foca em ciências da natureza inteira, física também"),
  },
];

/** Pedro's class test on Saturday, read on Thursday: Friday is its full review. */
const CLASS_TEST_TODAY = "2026-10-08";

/** His notes' skills, as the class test's skill graph names them, all in one area. */
const CELL_SKILLS = [
  ["theory", "Identificar os postulados da teoria celular"],
  ["prokaryotes", "Diferenciar células procariontes e eucariontes"],
  ["passive", "Analisar transporte passivo e osmose na membrana"],
  ["active", "Explicar transporte ativo e transporte vesicular"],
  ["organelles", "Explicar funções de ribossomos, retículo e mitocôndrias"],
  ["golgi", "Diferenciar golgi, lisossomos e organelas vegetais"],
  ["nucleus", "Descrever componentes e funções do núcleo celular"],
  ["virus", "Caracterizar a estrutura e reprodução dos vírus"],
].map(([skillId = "", name = ""]) => ({ area: "Biologia", name, skillId }));

function classTestInput(request: string): PlanEditInput {
  return {
    areas: ["Biologia"],
    dailyMinutes: 30,
    goalKind: "exam",
    language: "pt",
    request,
    skills: CELL_SKILLS,
    targetDate: "2026-10-10",
    today: CLASS_TEST_TODAY,
    weekdayMinutes: [30, 30, 30, 30, 30, 30, 30],
  };
}

const OSMOSIS_AND_ORGANELLES = {
  changes: [
    {
      areas: ["Biologia"],
      kind: "focusAreas" as const,
      parts: [{ area: "Biologia", skillIds: ["passive", "organelles", "golgi"] }],
    },
  ],
};

/**
 * A class test days away: "tomorrow only osmosis and organelles" is a focus on part of its one
 * area, which puts those topics first in the next study day and the day before's full review.
 * Pedro asked the buddy this in persona pass 7 and nothing changed (no change was read).
 */
export const CLASS_TEST_FOCUS_TEST_CASES: PlanEditTestCase[] = [
  {
    expected: { ...OSMOSIS_AND_ORGANELLES, leftOut: true },
    id: "pt-class-test-focus-tomorrow-pedro",
    userInput: classTestInput(
      "amanhã eu tenho 30 min. quero estudar osmose e organelas e treinar a dissertativa de osmose que a prof falou. o simulado é só no Plus? o que eu faço no lugar?",
    ),
  },
  {
    // The buddy's request: one self-contained sentence with every detail the conversation gave.
    expected: { ...OSMOSIS_AND_ORGANELLES, leftOut: true },
    id: "pt-class-test-focus-buddy-sentence",
    userInput: classTestInput(
      "Amanhã, nos meus 30 minutos, quero estudar osmose e organelas e treinar a dissertativa sobre osmose que a professora anunciou.",
    ),
  },
  {
    expected: OSMOSIS_AND_ORGANELLES,
    id: "pt-class-test-focus-review",
    userInput: classTestInput("Focar a revisão de amanhã em osmose e organelas"),
  },
];
