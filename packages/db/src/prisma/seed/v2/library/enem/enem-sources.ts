import { createHash } from "node:crypto";
import { type PrismaClient } from "../../../../../generated/prisma/client";
import { libraryIds } from "../library-ids";
import { type EnemEdition, formatDatePt } from "./enem-edition";

const INEP_ENEM_URL =
  "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem";

/** Passages of the Enem notice the blueprint cites, quoted as the stored text writes them. */
export function getNoticePassages(edition: EnemEdition) {
  const [firstDay, secondDay] = edition.examDays;

  return {
    areas:
      "O exame é composto por quatro provas objetivas, cada uma com 45 questões de múltipla escolha, e por uma redação em língua portuguesa.",
    essay:
      "A redação é um texto dissertativo-argumentativo sobre um tema de ordem social, científica, cultural ou política, com até 30 linhas.",
    essayScoring:
      "A redação é corrigida por dois avaliadores, que atribuem de 0 a 200 pontos a cada uma das cinco competências.",
    firstDay: `O primeiro dia de provas, em ${formatDatePt(firstDay)}, terá Linguagens, Códigos e suas Tecnologias, Ciências Humanas e suas Tecnologias e a redação, com 5 horas e 30 minutos de duração.`,
    irt: "As notas das provas objetivas são calculadas com base na Teoria de Resposta ao Item (TRI).",
    options: "Cada questão tem cinco alternativas, de A a E, e apenas uma é correta.",
    registration: `As inscrições vão de ${formatDatePt(edition.registration.start)} a ${formatDatePt(edition.registration.end)}, na Página do Participante.`,
    secondDay: `O segundo dia, em ${formatDatePt(secondDay)}, terá Ciências da Natureza e suas Tecnologias e Matemática e suas Tecnologias, com 5 horas de duração.`,
    start:
      "Nos dois dias, os portões fecham às 13h e as provas começam às 13h30, no horário de Brasília.",
    title: `Edital do Exame Nacional do Ensino Médio (Enem) ${edition.year}.`,
  } as const;
}

/** Passages of the survey of past papers that topic frequency cites. */
export const pastPaperPassages = {
  charts:
    "Leitura e interpretação de gráficos e tabelas é um dos temas mais frequentes de Matemática.",
  ecology: "Ecologia é o tema de Biologia mais cobrado em Ciências da Natureza.",
  electricity:
    "Eletricidade, especialmente circuitos simples, é presença regular nas questões de Física.",
  essay:
    "Na redação, a proposta de intervenção é a competência em que mais candidatos perdem pontos.",
  functions: "Funções aparecem com frequência média, em geral ligadas a situações do dia a dia.",
  percentages:
    "Porcentagem aparece em praticamente todas as provas de Matemática, quase sempre em situações de compra, juros e variação de preços.",
  reading: "Interpretação de texto é a base da maior parte das questões de Linguagens.",
  republic:
    "A Primeira República e a Era Vargas estão entre os temas de História do Brasil mais cobrados.",
} as const;

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * The two documents behind the Enem blueprint: the official notice (structure, rules and dates)
 * and a survey of past papers (how often each topic is asked). Both are in Portuguese, so the
 * English blueprint quotes them as written.
 */
export async function writeEnemSources({
  edition,
  now,
  prisma,
}: {
  edition: EnemEdition;
  now: Date;
  prisma: PrismaClient;
}): Promise<{ noticeHash: string }> {
  const noticeText = Object.values(getNoticePassages(edition)).join("\n\n");
  const surveyText = Object.values(pastPaperPassages).join("\n\n");
  const noticeHash = contentHash(noticeText);
  const noticeId = libraryIds.source("enem-notice");
  const surveyId = libraryIds.source("enem-past-papers");

  const notice = {
    contentHash: noticeHash,
    extractedText: noticeText,
    fetchedAt: now,
    identityKey: INEP_ENEM_URL.replace("https://www.", ""),
    kind: "official" as const,
    language: "pt",
    mimeType: "text/html",
    publisher: "Inep",
    title: `Edital do Enem ${edition.year}`,
    url: INEP_ENEM_URL,
    validUntil: new Date(`${edition.examDays[1]}T00:00:00.000Z`),
  };

  const survey = {
    contentHash: contentHash(surveyText),
    extractedText: surveyText,
    fetchedAt: now,
    identityKey: "seed:enem-past-papers",
    kind: "secondary" as const,
    language: "pt",
    title: "Temas recorrentes nas provas do Enem",
  };

  await Promise.all([
    prisma.source.upsert({
      create: { id: noticeId, ...notice },
      update: notice,
      where: { id: noticeId },
    }),
    prisma.source.upsert({
      create: { id: surveyId, ...survey },
      update: survey,
      where: { id: surveyId },
    }),
  ]);

  return { noticeHash };
}
