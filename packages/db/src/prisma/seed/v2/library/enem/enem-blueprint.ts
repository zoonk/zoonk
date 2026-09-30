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

function cite(sourceId: string, passage: string) {
  return { passage, sourceId };
}

function buildStructure(notice: ReturnType<typeof getNoticePassages>) {
  const area = (name: ReturnType<typeof t>, topics: ReturnType<typeof t>[]) => ({
    citation: cite(NOTICE, notice.areas),
    name,
    questions: QUESTIONS_PER_AREA,
    topics,
    weight: null,
  });

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
    subjects: [
      area(t("Languages, Codes and their Technologies", "Linguagens, Códigos e suas Tecnologias"), [
        t("Reading comprehension", "Interpretação de texto"),
        t("Functions of language", "Funções da linguagem"),
        t("Foreign language (English or Spanish)", "Língua estrangeira (inglês ou espanhol)"),
      ]),
      area(t("Humanities and their Technologies", "Ciências Humanas e suas Tecnologias"), [
        t("Brazil's Republic", "Brasil República"),
        t("Urban geography", "Geografia urbana"),
        t("Philosophy and sociology", "Filosofia e sociologia"),
      ]),
      area(
        t("Natural Sciences and their Technologies", "Ciências da Natureza e suas Tecnologias"),
        [
          t("Ecology", "Ecologia"),
          t("Electricity", "Eletricidade"),
          t("Organic chemistry", "Química orgânica"),
        ],
      ),
      area(t("Mathematics and its Technologies", "Matemática e suas Tecnologias"), [
        t("Percentages", "Porcentagem"),
        t("Ratios and proportions", "Razão e proporção"),
        t("Functions", "Funções"),
        t("Statistics and charts", "Estatística e gráficos"),
      ]),
      {
        citation: cite(NOTICE, notice.essay),
        name: t("Essay", "Redação"),
        questions: null,
        topics: [
          t("The intervention proposal", "Proposta de intervenção"),
          t("The five competencies", "As cinco competências"),
        ],
        weight: null,
      },
    ],
  };
}

const MATH = t("Mathematics", "Matemática");
const SCIENCES = t("Natural Sciences", "Ciências da Natureza");

const topicFrequency = [
  {
    basis: t(
      "Asked in almost every edition, usually about shopping, interest and price changes.",
      "Cai em quase toda edição, em geral em compras, juros e variação de preços.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.percentages),
    level: "high",
    subject: MATH,
    topic: t("Percentages", "Porcentagem"),
  },
  {
    basis: t(
      "Reading charts and tables is one of the most frequent math topics.",
      "Ler gráficos e tabelas é um dos temas mais frequentes de Matemática.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.charts),
    level: "high",
    subject: MATH,
    topic: t("Statistics and charts", "Estatística e gráficos"),
  },
  {
    basis: t(
      "Asked regularly, tied to everyday situations.",
      "Aparece com regularidade, ligada a situações do dia a dia.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.functions),
    level: "medium",
    subject: MATH,
    topic: t("Functions", "Funções"),
  },
  {
    basis: t(
      "The biology topic asked most in Natural Sciences.",
      "O tema de Biologia mais cobrado em Ciências da Natureza.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.ecology),
    level: "high",
    subject: SCIENCES,
    topic: t("Ecology", "Ecologia"),
  },
  {
    basis: t(
      "A regular in physics questions, mostly simple circuits.",
      "Presença regular em Física, principalmente circuitos simples.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.electricity),
    level: "medium",
    subject: SCIENCES,
    topic: t("Electricity", "Eletricidade"),
  },
  {
    basis: t(
      "The First Republic and the Vargas Era are among the most asked topics in Brazilian history.",
      "A Primeira República e a Era Vargas estão entre os temas mais cobrados de História do Brasil.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.republic),
    level: "high",
    subject: t("Humanities", "Ciências Humanas"),
    topic: t("Brazil's Republic", "Brasil República"),
  },
  {
    basis: t(
      "Most Languages questions start from reading a text.",
      "A maior parte das questões de Linguagens parte da leitura de um texto.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.reading),
    level: "high",
    subject: t("Languages", "Linguagens"),
    topic: t("Reading comprehension", "Interpretação de texto"),
  },
  {
    basis: t(
      "The competency where most candidates lose points.",
      "A competência em que mais candidatos perdem pontos.",
    ),
    citation: cite(PAST_PAPERS, pastPaperPassages.essay),
    level: "high",
    subject: t("Essay", "Redação"),
    topic: t("The intervention proposal", "Proposta de intervenção"),
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
