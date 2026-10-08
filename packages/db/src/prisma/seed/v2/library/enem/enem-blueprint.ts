import { readFileSync } from "node:fs";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { type PrismaClient } from "../../../../../generated/prisma/client";
import { daysFrom } from "../../_utils/dates";
import { SEED_LANGUAGES, type SeedLanguage, localizeObject, t } from "../../_utils/localize";
import { SEED_PROVENANCE } from "../../_utils/provenance";
import { libraryIds } from "../library-ids";
import { type EnemEdition } from "./enem-edition";
import { getNoticePassages, pastPaperPassages, writeEnemSources } from "./enem-sources";

const NOTICE = libraryIds.source("enem-notice");
const PAST_PAPERS = libraryIds.source("enem-past-papers");
const QUESTIONS_PER_AREA = 45;
const DAY_ONE_MINUTES = 330;
const DAY_TWO_MINUTES = 300;
const RECHECK_DAYS = 7;
/** Enem starts at 1:30 pm, Brasília time, on both days. */
const START_TIME = "13:30";

/** The instructions research reads a notice with (`EXAM_BLUEPRINT_PROMPT_VERSION` in `@zoonk/ai`). */
const READING_PROMPT = new URL(
  "../../../../../../../ai/src/tasks/v2/research/extract-exam-blueprint.prompt.md",
  import.meta.url,
);

/**
 * The seeded notice counts as read with today's instructions, as a reading research just stored
 * would: an older version makes research read it again for the first ENEM learner, minutes of
 * waiting before their first question (see `isNoticeReadAgain`). Only the seed writes this.
 */
function getReadingPromptVersion(): string {
  return getPromptVersion({ systemPrompt: readFileSync(READING_PROMPT, "utf8") });
}

function cite(sourceId: string, passage: string) {
  return { passage, sourceId };
}

/*
 * The notice's contents ("objetos de conhecimento") as it words them, the ones past papers rate
 * named once so the topic frequency below names them exactly.
 */
const LANGUAGES_READING = t(
  "Text study: discourse sequences and text genres in communication and information",
  "Estudo do texto: as sequências discursivas e os gêneros textuais no sistema de comunicação e informação",
);

const HUMANITIES_STATE = t(
  "Forms of social organization, social movements, political thought and the State",
  "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
);

const MATH_NUMBERS = t("Numbers", "Conhecimentos numéricos");

const MATH_STATISTICS = t(
  "Statistics and probability",
  "Conhecimentos de estatística e probabilidade",
);

const MATH_ALGEBRA = t("Algebra", "Conhecimentos algébricos");
const SCIENCE_ECOLOGY = t("Ecology and environmental science", "Ecologia e ciências ambientais");

const SCIENCE_ELECTRICITY = t(
  "Electric and magnetic phenomena",
  "Fenômenos Elétricos e Magnéticos",
);

/** Ciências da Natureza's contents under the notice's headings: physics, chemistry and biology. */
const SCIENCE_GROUPS = [
  {
    name: t("Physics", "Física"),
    topics: [
      t("Basic and fundamental knowledge", "Conhecimentos básicos e fundamentais"),
      t(
        "Motion, equilibrium and the discovery of physical laws",
        "O movimento, o equilíbrio e a descoberta de leis físicas",
      ),
      t("Energy, work and power", "Energia, trabalho e potência"),
      t("Mechanics and how the Universe works", "A Mecânica e o funcionamento do Universo"),
      SCIENCE_ELECTRICITY,
      t("Oscillations, waves, optics and radiation", "Oscilações, ondas, óptica e radiação"),
      t("Heat and thermal phenomena", "O calor e os fenômenos térmicos"),
    ],
  },
  {
    name: t("Chemistry", "Química"),
    topics: [
      t("Chemical transformations", "Transformações Químicas"),
      t("Representing chemical transformations", "Representação das transformações químicas"),
      t("Materials, their properties and uses", "Materiais, suas propriedades e usos"),
      t("Water", "Água"),
      t("Chemical transformations and energy", "Transformações Químicas e Energia"),
      t("Dynamics of chemical transformations", "Dinâmica das Transformações Químicas"),
      t("Chemical transformation and equilibrium", "Transformação Química e Equilíbrio"),
      t("Carbon compounds", "Compostos de Carbono"),
      t(
        "Chemistry, technology, society and the environment",
        "Relações da Química com as Tecnologias, a Sociedade e o Meio Ambiente",
      ),
      t("Chemical energy in everyday life", "Energias Químicas no Cotidiano"),
    ],
  },
  {
    name: t("Biology", "Biologia"),
    topics: [
      t("Molecules, cells and tissues", "Moléculas, células e tecidos"),
      t("Heredity and the diversity of life", "Hereditariedade e diversidade da vida"),
      t("Identity of living beings", "Identidade dos seres vivos"),
      SCIENCE_ECOLOGY,
      t("Origin and evolution of life", "Origem e evolução da vida"),
      t("Quality of life of human populations", "Qualidade de vida das populações humanas"),
    ],
  },
];

/** The notice's five parts, each with its contents as the notice words them. */
function buildSubjects(notice: ReturnType<typeof getNoticePassages>) {
  const area = (name: ReturnType<typeof t>, topics: ReturnType<typeof t>[]) => ({
    citation: cite(NOTICE, notice.areas),
    name,
    questions: QUESTIONS_PER_AREA,
    topics,
    weight: null,
  });

  return [
    area(t("Languages, Codes and their Technologies", "Linguagens, Códigos e suas Tecnologias"), [
      LANGUAGES_READING,
      t(
        "Body practices: body language as social integration and identity",
        "Estudo das práticas corporais: a linguagem corporal como integradora social e formadora de identidade",
      ),
      t(
        "Producing and receiving artistic texts: interpreting and representing the world for identity and citizenship",
        "Produção e recepção de textos artísticos: interpretação e representação do mundo para o fortalecimento dos processos de identidade e cidadania",
      ),
      t(
        "Literary texts: literature and society, artistic conceptions, how texts are built and received",
        "Estudo do texto literário: relações entre produção literária e processo social, concepções artísticas, procedimentos de construção e recepção de textos",
      ),
      t(
        "Linguistic features of different texts: expressive resources, how texts are built and received",
        "Estudo dos aspectos linguísticos em diferentes textos: recursos expressivos da língua, procedimentos de construção e recepção de textos",
      ),
      t(
        "Argumentative texts, their genres and linguistic resources",
        "Estudo do texto argumentativo, seus gêneros e recursos linguísticos: argumentação: tipo, gêneros e usos em língua portuguesa",
      ),
      t(
        "Portuguese in use: the standard norm and linguistic variation",
        "Estudo dos aspectos linguísticos da língua portuguesa: usos da língua: norma culta e variação linguística",
      ),
      t(
        "Digital genres: communication and information technology, its impact and social role",
        "Estudo dos gêneros digitais: tecnologia da comunicação e informação: impacto e função social",
      ),
    ]),
    area(t("Humanities and their Technologies", "Ciências Humanas e suas Tecnologias"), [
      t(
        "Cultural diversity, conflicts and life in society",
        "Diversidade cultural, conflitos e vida em sociedade",
      ),
      HUMANITIES_STATE,
      t(
        "Productive structures and how they change",
        "Características e transformações das estruturas produtivas",
      ),
      t(
        "Natural domains and how people relate to the environment",
        "Os domínios naturais e a relação do ser humano com o ambiente",
      ),
      t("Spatial representation", "Representação espacial"),
    ]),
    {
      ...area(
        t("Natural Sciences and their Technologies", "Ciências da Natureza e suas Tecnologias"),
        SCIENCE_GROUPS.flatMap((group) => group.topics),
      ),
      topicGroups: SCIENCE_GROUPS,
    },
    area(t("Mathematics and its Technologies", "Matemática e suas Tecnologias"), [
      MATH_NUMBERS,
      t("Geometry", "Conhecimentos geométricos"),
      MATH_STATISTICS,
      MATH_ALGEBRA,
      t("Algebra and geometry", "Conhecimentos algébricos/geométricos"),
    ]),
    {
      citation: cite(NOTICE, notice.essay),
      name: t("Essay", "Redação"),
      questions: null,
      topics: [
        t(
          "An argumentative essay on a problem situation",
          "Texto dissertativo-argumentativo a partir de uma situação-problema",
        ),
      ],
      weight: null,
    },
  ];
}

function buildStructure(notice: ReturnType<typeof getNoticePassages>) {
  return {
    formats: [
      {
        citation: cite(NOTICE, notice.options),
        description: t(
          "Multiple choice with five options, A to E",
          "Múltipla escolha com cinco alternativas, de A a E",
        ),
        kind: "multipleChoice",
        options: 5,
      },
      {
        citation: cite(NOTICE, notice.essay),
        description: t(
          "An argumentative essay of up to 30 lines",
          "Redação dissertativo-argumentativa de até 30 linhas",
        ),
        kind: "essay",
        options: null,
      },
    ],
    mock: {
      adaptive: false,
      citations: [
        cite(NOTICE, notice.firstDay),
        cite(NOTICE, notice.secondDay),
        cite(NOTICE, notice.irt),
      ],
      order: t(
        "Day 1: Languages, Humanities and the essay. Day 2: Natural Sciences and Math.",
        "1º dia: Linguagens, Ciências Humanas e redação. 2º dia: Ciências da Natureza e Matemática.",
      ),
      scoring: {
        description: t(
          "Item response theory: a right answer counts for more when the pattern of answers is consistent.",
          "Teoria de Resposta ao Item: um acerto vale mais quando o padrão de respostas é coerente.",
        ),
        method: "itemResponseTheory",
      },
      sections: [
        {
          day: 1,
          minutes: DAY_ONE_MINUTES,
          name: t("Languages, Humanities and essay", "Linguagens, Ciências Humanas e redação"),
          questions: 90,
        },
        {
          day: 2,
          minutes: DAY_TWO_MINUTES,
          name: t("Natural Sciences and Math", "Ciências da Natureza e Matemática"),
          questions: 90,
        },
      ],
      timeLimitMinutes: null,
      totalQuestions: 180,
    },
    rules: [
      {
        citation: cite(NOTICE, notice.options),
        text: t(
          "Each question has exactly one right option.",
          "Cada questão tem uma única alternativa correta.",
        ),
      },
      {
        citation: cite(NOTICE, notice.irt),
        text: t(
          "Multiple-choice scores use item response theory (IRT).",
          "As notas das provas objetivas usam a Teoria de Resposta ao Item (TRI).",
        ),
      },
      {
        citation: cite(NOTICE, notice.essayScoring),
        text: t(
          "Two graders score the essay from 0 to 200 on each of five competencies.",
          "Dois avaliadores dão de 0 a 200 pontos em cada uma das cinco competências da redação.",
        ),
      },
      {
        citation: cite(NOTICE, notice.start),
        text: t(
          "Gates close at 1 pm and exams start at 1:30 pm, Brasília time.",
          "Os portões fecham às 13h e as provas começam às 13h30, horário de Brasília.",
        ),
      },
    ],
    subjects: buildSubjects(notice),
  };
}

const MATH = t("Mathematics", "Matemática");
const SCIENCES = t("Natural Sciences", "Ciências da Natureza");

/** How often past papers ask the topics they rate most, on the notice's own topics. */
const topicFrequency = [
  {
    basis: t(
      "Percentages come up in almost every edition, usually about shopping, interest and price changes.",
      "Porcentagem cai em quase toda edição, em geral em compras, juros e variação de preços.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.percentages),
    level: "high",
    subject: MATH,
    topic: MATH_NUMBERS,
  },
  {
    basis: t(
      "Reading charts and tables is one of the most frequent math topics.",
      "Ler gráficos e tabelas é um dos temas mais frequentes de Matemática.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.charts),
    level: "high",
    subject: MATH,
    topic: MATH_STATISTICS,
  },
  {
    basis: t(
      "Functions are asked regularly, tied to everyday situations.",
      "Funções aparecem com regularidade, ligadas a situações do dia a dia.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.functions),
    level: "medium",
    subject: MATH,
    topic: MATH_ALGEBRA,
  },
  {
    basis: t(
      "The biology topic asked most in Natural Sciences.",
      "O tema de Biologia mais cobrado em Ciências da Natureza.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.ecology),
    level: "high",
    subject: SCIENCES,
    topic: SCIENCE_ECOLOGY,
  },
  {
    basis: t(
      "A constant in physics questions, mostly simple circuits.",
      "Presença constante em Física, principalmente circuitos simples.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.electricity),
    level: "high",
    subject: SCIENCES,
    topic: SCIENCE_ELECTRICITY,
  },
  {
    basis: t(
      "The First Republic and the Vargas Era are among the most asked topics in Brazilian history.",
      "A Primeira República e a Era Vargas estão entre os temas mais cobrados de História do Brasil.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.republic),
    level: "high",
    subject: t("Humanities", "Ciências Humanas"),
    topic: HUMANITIES_STATE,
  },
  {
    basis: t(
      "Most Languages questions start from reading a text.",
      "A maior parte das questões de Linguagens parte da leitura de um texto.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.reading),
    level: "high",
    subject: t("Languages", "Linguagens"),
    topic: LANGUAGES_READING,
  },
];

function buildEdition(
  edition: EnemEdition,
  notice: ReturnType<typeof getNoticePassages>,
  noticeHash: string,
) {
  const [firstDay, secondDay] = edition.examDays;

  return {
    citations: [cite(NOTICE, notice.title), cite(NOTICE, notice.areas)],
    dates: [
      {
        citation: cite(NOTICE, notice.registration),
        date: edition.registration.start,
        kind: "registrationStart",
        label: t("Registration opens", "Início das inscrições"),
        startTime: null,
      },
      {
        citation: cite(NOTICE, notice.registration),
        date: edition.registration.end,
        kind: "registrationEnd",
        label: t("Registration closes", "Fim das inscrições"),
        startTime: null,
      },
      {
        citation: cite(NOTICE, notice.firstDay),
        date: firstDay,
        kind: "exam",
        label: t("Day 1", "1º dia de provas"),
        startTime: START_TIME,
      },
      {
        citation: cite(NOTICE, notice.secondDay),
        date: secondDay,
        kind: "exam",
        label: t("Day 2", "2º dia de provas"),
        startTime: START_TIME,
      },
    ],
    noticeUrl:
      "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem",
    questionCount: 180,
    sourceHash: noticeHash,
    timeZone: "America/Sao_Paulo",
    year: edition.year,
  };
}

async function writeBlueprint(
  prisma: PrismaClient,
  {
    edition,
    language,
    noticeHash,
    now,
  }: { edition: EnemEdition; language: SeedLanguage; noticeHash: string; now: Date },
) {
  const id = libraryIds.blueprint("enem", language);
  const notice = getNoticePassages(edition);
  const examDate = new Date(`${edition.examDays[1]}T00:00:00.000Z`);

  const data = {
    board: "Inep",
    country: "BR",
    edition: localizeObject(buildEdition(edition, notice, noticeHash), language),
    examDate,
    identityKey: "enem",
    language,
    name: "ENEM",
    nextCheckAt: daysFrom(now, RECHECK_DAYS),
    registrationEndsAt: new Date(`${edition.registration.end}T00:00:00.000Z`),
    sourceId: NOTICE,
    structure: localizeObject(buildStructure(notice), language),
    topicFrequency: topicFrequency.map((entry) => localizeObject(entry, language)),
    validUntil: examDate,
    ...SEED_PROVENANCE,
    promptVersion: getReadingPromptVersion(),
  };

  await prisma.examBlueprint.upsert({ create: { id, ...data }, update: data, where: { id } });
}

/** The Enem blueprint in both languages, with the documents every fact cites. */
export async function writeEnemBlueprint({
  edition,
  now,
  prisma,
}: {
  edition: EnemEdition;
  now: Date;
  prisma: PrismaClient;
}): Promise<void> {
  const { noticeHash } = await writeEnemSources({ edition, now, prisma });

  await Promise.all(
    SEED_LANGUAGES.map((language) =>
      writeBlueprint(prisma, { edition, language, noticeHash, now }),
    ),
  );
}
