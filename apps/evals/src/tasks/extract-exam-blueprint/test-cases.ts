import { type TestCase } from "@/lib/types";
import { type ExtractionEvalInput } from "./generate";
import { type ExtractionExpected } from "./task";

const OAB_48_NOTICE = {
  title: "Edital de abertura do 48º Exame de Ordem Unificado",
  url: "https://s.oab.org.br/arquivos/2026/09/fb43fb37-838e-4d33-a863-99fa1f98b921.pdf",
};

const CGU_2026_NOTICE = {
  title: "Edital nº 1 – CGU 2026 – Auditor Federal de Finanças e Controle (atualizado)",
  url: "https://cdn.cebraspe.org.br/concursos/CGU_26_AFFC/arquivos/FDEEFB41D8ACD48AB369A9915EA1A48C67389EC91427E98F6F264E19B1F63FB9.pdf",
};

const UPSC_CSE_2026_NOTICE = {
  title: "Civil Services Examination 2026 notice",
  url: "https://www.upsc.gov.in/sites/default/files/Notif-CSP-2026-Engl-060226Rev.pdf",
};

/** An invented notice whose written test states its lines but no scale or grading rule. */
const NO_SCALE_NOTICE = `PREFEITURA MUNICIPAL DE VALE ALTO
EDITAL Nº 3/2026 – CONCURSO PÚBLICO PARA O CARGO DE ASSISTENTE ADMINISTRATIVO

5 DAS PROVAS
5.1 O concurso será composto de prova objetiva e de prova discursiva, aplicadas no mesmo dia, com duração total de 4 horas.
5.2 A prova objetiva terá 40 questões de múltipla escolha, com cinco alternativas cada, sobre Língua Portuguesa (15 questões), Noções de Informática (10 questões) e Conhecimentos Específicos (15 questões).
5.3 A prova discursiva consistirá na redação de um texto dissertativo, com extensão máxima de 30 linhas, sobre tema de atualidade relacionado à administração pública municipal.
5.4 A prova discursiva será corrigida apenas para os candidatos classificados na prova objetiva até a 50ª posição.
6 DO CRONOGRAMA
6.1 As provas serão aplicadas em 15 de março de 2027.`;

export const TEST_CASES: TestCase<ExtractionExpected, ExtractionEvalInput>[] = [
  {
    expected: {
      facts: [
        { kind: "scoring", method: "wrongCancelsRight" },
        { groups: ["P1", "P2", "P3", "P4"], kind: "groupedSubjects" },
        { kind: "subject", name: "Prova discursiva" },
        { kind: "markingRow", part: ["P3"], points: 2, wrongPoints: 2 },
        { kind: "scoredPart", minimum: { unit: "points", value: 8 }, part: ["P1"], questions: 40 },
        { kind: "scoredPart", minimum: { unit: "points", value: 12 }, part: ["P2"], questions: 40 },
        { kind: "scoredPart", minimum: { unit: "points", value: 54 }, part: ["P3"], questions: 90 },
        { kind: "scoredPart", minimum: { unit: "points", value: 50 }, part: ["P4", "discursiva"] },
        { kind: "totalMinimum", minimum: { unit: "points", value: 78 } },
        { kind: "finalShare", parts: ["P1", "P2", "P3"], share: 0.5 },
        { kind: "finalShare", parts: ["discursiva"], share: 0.5 },
        { kind: "session", mentions: "manhã" },
        { kind: "session", mentions: "tarde" },
        {
          count: 1,
          criterionPoints: [30],
          drawsOn: "P2",
          grading: "points",
          handwritten: true,
          kind: "writtenTask",
          language: { factor: 6, method: "errorsPerLine" },
          lines: 30,
          points: 30,
          rounding: false,
          zeroing: true,
        },
        {
          count: 1,
          criterionPoints: [70],
          drawsOn: "P3",
          grading: "points",
          handwritten: true,
          kind: "writtenTask",
          language: { factor: 14, method: "errorsPerLine" },
          lines: 60,
          points: 70,
          rounding: false,
          zeroing: true,
        },
      ],
    },
    id: "cgu-2026-affc-ti-points",
    language: "pt",
    userInput: {
      documents: [CGU_2026_NOTICE],
      exam: "CGU 2026, Auditor Federal de Finanças e Controle, TI – Desenvolvimento de Sistemas",
    },
  },
  {
    expected: {
      facts: [
        { kind: "scoring", method: "wrongCancelsRight" },
        { kind: "markingRow", part: ["Paper I"], points: 2, wrongPoints: 2 / 3 },
        { kind: "markingRow", part: ["Paper II", "CSAT"], points: 2.5, wrongPoints: 2.5 / 3 },
        { kind: "scoredPart", maxPoints: 200, part: ["Paper I"] },
        {
          kind: "scoredPart",
          minimum: { unit: "percent", value: 33 },
          part: ["Paper II", "CSAT"],
          qualifying: true,
        },
        { kind: "totalMinimum", minimum: null },
      ],
    },
    id: "upsc-cse-2026-prelims-points",
    language: "en",
    userInput: {
      documents: [UPSC_CSE_2026_NOTICE],
      exam: "UPSC Civil Services (Preliminary) Examination 2026",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 180 },
        { date: "2026-11-08", dateKind: "exam", kind: "date" },
        { date: "2026-11-15", dateKind: "exam", kind: "date" },
        { date: "2026-06-05", dateKind: "registrationEnd", kind: "date" },
        { kind: "subject", name: "Linguagens", questions: 45 },
        { kind: "subject", name: "Matemática", questions: 45 },
        { kind: "choice", options: ["Inglês", "Espanhol"], partOf: "Linguagens" },
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "scoring", method: "itemResponseTheory" },
        { kind: "timeLimit", minutes: 330 },
        { kind: "timeLimit", minutes: 300 },
        { kind: "testedLanguage", language: null },
        { kind: "sharedClock" },
        {
          count: 1,
          grading: "enem",
          kind: "writtenTask",
          lines: null,
          points: 1000,
          zeroing: true,
        },
      ],
    },
    id: "enem-2026",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital Inep nº 64, de 21 de maio de 2026 (Enem 2026)",
          url: "http://www.abmes.org.br/arquivos/legislacoes/Edital-inep-064-2026-05-21.pdf",
        },
      ],
      exam: "ENEM",
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Ciências da Natureza e suas Tecnologias" },
        {
          kind: "topic",
          subject: "Ciências da Natureza e suas Tecnologias",
          topic: "Moléculas, células e tecidos",
        },
        {
          kind: "topic",
          subject: "Ciências da Natureza e suas Tecnologias",
          topic: "Hereditariedade e diversidade da vida",
        },
        {
          kind: "topic",
          subject: "Matemática e suas Tecnologias",
          topic: "Conhecimentos numéricos",
        },
        {
          kind: "topic",
          subject: "Ciências Humanas e suas Tecnologias",
          topic: "Diversidade cultural, conflitos e vida em sociedade",
        },
      ],
    },
    id: "enem-2026-matriz",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Matriz de Referência Enem",
          url: "https://download.inep.gov.br/download/enem/matriz_referencia.pdf",
        },
      ],
      exam: "ENEM",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 150 },
        { kind: "section", questions: 35 },
        { kind: "section", questions: 45 },
        { kind: "section", questions: 70 },
        { format: "trueFalse", kind: "format" },
        { kind: "scoring", method: "wrongCancelsRight" },
        { kind: "wrongPenalty", value: 1 },
        { kind: "timeLimit", minutes: 240 },
        { date: "2026-11-22", dateKind: "exam", kind: "date" },
        { date: "2026-08-26", dateKind: "registrationStart", kind: "date" },
        { date: "2026-09-17", dateKind: "registrationEnd", kind: "date" },
      ],
    },
    id: "tcdf-2026",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – TCDF/ANACE, de 8 de julho de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/7971F586B9A9CE2C60801C731D8A1CD87F4C5136CA1F1E346C27C5C743773A73.pdf",
        },
      ],
      exam: "Concurso TCDF, Analista Administrativo de Controle Externo",
    },
  },
  {
    expected: {
      facts: [
        {
          kind: "choice",
          options: [
            "Auditoria",
            "Ciência de Dados",
            "Infraestrutura",
            "Desenvolvimento de Sistemas",
          ],
        },
        { kind: "subject", name: "Desenvolvimento de Sistemas", questions: 90 },
        { group: "P3", kind: "group", subject: "Desenvolvimento de Sistemas" },
        {
          kind: "topic",
          subject: "Desenvolvimento de Sistemas",
          topic: "1.2 Requisitos funcionais e não funcionais",
        },
        {
          kind: "topic",
          subject: "Infraestrutura",
          topic:
            "1.1 Modelos TCP/IP e OSI; IPv4 e IPv6, DNS, DHCP, roteamento, segmentação, balanceamento e qualidade de serviço",
        },
        { group: "P1", kind: "group", subject: "Estado, Democracia, Direitos e Ciência Política" },
        { group: "P2", kind: "group", subject: "Fundamentos de Auditoria Governamental" },
      ],
    },
    id: "cgu-2026-auditor-specialties",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – CGU – AFFC, de 8 de outubro de 2026 (versão atualizada)",
          url: "https://cdn.cebraspe.org.br/concursos/cgu_26_affc/arquivos/FDEEFB41D8ACD48AB369A9915EA1A48C67389EC91427E98F6F264E19B1F63FB9.pdf",
        },
      ],
      exam: "Concurso CGU 2026, Auditor Federal de Finanças e Controle",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-01-17", dateKind: "exam", kind: "date" },
        { format: "trueFalse", kind: "format" },
        { kind: "scoring", method: "wrongCancelsRight" },
        { kind: "section", minutes: 300, questions: 180 },
        { kind: "subject", name: "Língua Portuguesa" },
        { kind: "subject", name: "Linguística" },
        { kind: "subject", name: "Ciência Política" },
        { group: "P1", kind: "group", subject: "Língua Portuguesa" },
        { group: "P2", kind: "group", subject: "Linguística" },
        {
          kind: "topic",
          subject: "Língua Portuguesa",
          topic: "5.7 Emprego do sinal indicativo de crase",
        },
        {
          kind: "topic",
          subject: "Língua Portuguesa",
          topic: "6.4 Reescrita de textos de diferentes gêneros e níveis de formalidade",
        },
        {
          kind: "topic",
          subject: "Linguística",
          topic: "12 Noções básicas de lógica: conectivos, argumentos e notação",
        },
        {
          kind: "topic",
          subject: "Ciência Política",
          topic: "11 História do voto e dos partidos no Brasil",
        },
      ],
    },
    id: "camara-2026-registro-redacao",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – Câmara dos Deputados, de 2 de outubro de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/CD_26_ANALISTA/arquivos/BBE30D016054F40651E36AC7B302C3425BD148A39675CA840A5A0CCBFBB5F0F1.pdf",
        },
      ],
      exam: "Câmara dos Deputados, Analista Legislativo – Registro e Redação",
    },
  },
  {
    expected: {
      facts: [
        { kind: "section", minutes: 300, questions: 80 },
        { format: "multipleChoice", kind: "format" },
        { kind: "scoring", method: "raw" },
        { kind: "timeLimit", minutes: 300 },
        { date: "2026-06-01", dateKind: "registrationStart", kind: "date" },
        { date: "2026-06-08", dateKind: "registrationEnd", kind: "date" },
        { date: "2026-09-06", dateKind: "exam", kind: "date" },
        { date: "2026-10-18", dateKind: "exam", kind: "date" },
        { date: "2026-12-03", dateKind: "results", kind: "date" },
      ],
    },
    id: "oab-47",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital de abertura do 47º Exame de Ordem Unificado",
          url: "https://s.oab.org.br/arquivos/2026/05/3578986c-fb9e-42ed-b68b-9a5131c86c9a.pdf",
        },
      ],
      exam: "47º Exame de Ordem Unificado (OAB)",
    },
  },
  {
    expected: {
      facts: [
        { kind: "section", minutes: 300 },
        { kind: "session", mentions: "13" },
        {
          count: 1,
          grading: "oab",
          handwritten: true,
          kind: "writtenTask",
          language: null,
          lines: null,
          points: 5,
          rounding: true,
          zeroing: true,
        },
        {
          count: 4,
          grading: "oab",
          handwritten: true,
          kind: "writtenTask",
          lines: 30,
          points: 1.25,
        },
      ],
    },
    id: "oab-47-2a-fase-written",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital de abertura do 47º Exame de Ordem Unificado",
          url: "https://s.oab.org.br/arquivos/2026/05/3578986c-fb9e-42ed-b68b-9a5131c86c9a.pdf",
        },
      ],
      exam: "47º Exame de Ordem Unificado (OAB), 2ª fase: prova prático-profissional",
    },
  },
  {
    expected: {
      facts: [
        {
          count: 1,
          criterionPoints: [],
          drawsOn: null,
          grading: null,
          handwritten: null,
          kind: "writtenTask",
          language: null,
          lines: 30,
          points: null,
        },
        { kind: "section", minutes: 240, questions: 40 },
        { kind: "sharedClock" },
      ],
    },
    id: "municipal-notice-written-no-scale",
    language: "pt",
    userInput: {
      documents: [{ text: NO_SCALE_NOTICE, title: "Edital nº 3/2026 – Prefeitura de Vale Alto" }],
      exam: "Concurso da Prefeitura de Vale Alto, Assistente Administrativo",
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Ética" },
        { kind: "subject", name: "Direitos Humanos" },
        { kind: "subject", name: "Filosofia do Direito" },
        { kind: "subject", name: "Direito Eleitoral" },
        { kind: "subject", name: "Direito Civil" },
        { kind: "subject", name: "Direito Processual Penal" },
        { kind: "section", minutes: 300, questions: 80 },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-01-10", dateKind: "exam", kind: "date" },
        { date: "2027-02-28", dateKind: "other", kind: "date" },
      ],
    },
    id: "oab-48-1a-fase",
    language: "pt",
    userInput: { documents: [OAB_48_NOTICE], exam: "OAB Exame de Ordem Unificado, 1ª fase" },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Ética" },
        { kind: "subject", name: "Direitos Humanos" },
        { kind: "subject", name: "Direito Civil" },
        { kind: "section", minutes: 300, questions: 80 },
      ],
    },
    id: "oab-48-1a-fase-told-ethics",
    language: "pt",
    userInput: {
      documents: [OAB_48_NOTICE],
      exam: "OAB Exame de Ordem Unificado, 1ª fase",
      leftOut: [
        {
          citation: {
            passage:
              "Direito Eleitoral, bem como Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB.",
            sourceId: "document-1",
          },
          kind: "missingSubject",
          name: "Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB",
        },
      ],
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 98 },
        { kind: "section", minutes: 64, questions: 54 },
        { kind: "section", minutes: 70, questions: 44 },
        { kind: "timeLimit", minutes: 134 },
        { kind: "breakAfter", minutes: 10 },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-03-06", dateKind: "exam", kind: "date" },
        { date: "2027-02-19", dateKind: "registrationEnd", kind: "date" },
      ],
    },
    id: "sat",
    language: "en",
    userInput: {
      documents: [
        {
          title: "SAT Test Structure",
          url: "https://satsuite.collegeboard.org/sat/whats-on-the-test/structure",
        },
        {
          title: "SAT Suite Test Dates and Deadlines",
          url: "https://satsuite.collegeboard.org/sat/dates-deadlines",
        },
      ],
      exam: "SAT",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 48 },
        { kind: "section", minutes: 100, questions: 42 },
        { kind: "section", minutes: 90, questions: 6 },
        { kind: "timeLimit", minutes: 190 },
        { kind: "tools", mentions: "calculator" },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-05-10", dateKind: "exam", kind: "date" },
      ],
    },
    id: "ap-calculus-ab-2027",
    language: "en",
    userInput: {
      documents: [
        {
          title: "AP Calculus AB: About the Exam",
          url: "https://apstudents.collegeboard.org/courses/ap-calculus-ab/assessment",
        },
        { title: "2027 AP Exam Dates", url: "https://apstudents.collegeboard.org/exam-dates" },
      ],
      exam: "AP Calculus AB 2027",
    },
  },
  {
    expected: {
      facts: [
        { kind: "timeLimit", minutes: 165 },
        { kind: "section", minutes: 30, questions: 40 },
        { kind: "section", minutes: 60, questions: 40 },
        { kind: "listeningParts", parts: 4, plays: 1, questions: 10 },
        { format: "essay", kind: "format" },
        { format: "oral", kind: "format" },
        { kind: "testedLanguage", language: "en" },
      ],
    },
    id: "ielts-academic",
    language: "en",
    userInput: {
      documents: [
        {
          title: "IELTS Academic test",
          url: "https://ielts.org/take-a-test/test-types/ielts-academic-test",
        },
        {
          title: "IELTS Academic test format in detail",
          url: "https://ielts.org/organisations/ielts-for-organisations/test-types/ielts-academic-test",
        },
      ],
      exam: "IELTS Academic",
    },
  },
  {
    expected: {
      facts: [
        { kind: "timeLimit", minutes: 165 },
        { kind: "section", minutes: 60, questions: 40 },
        { format: "essay", kind: "format" },
        { format: "oral", kind: "format" },
      ],
    },
    id: "ielts-academic-research-pages",
    language: "en",
    userInput: {
      documents: [
        {
          title: "IELTS Academic test format and sections",
          url: "https://ielts.org/take-a-test/test-types/ielts-academic-test",
        },
        {
          title: "IELTS Academic: Writing test format",
          url: "https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing",
        },
        {
          title: "Speaking Band Descriptors",
          url: "https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf",
        },
        {
          title: "Writing Band Descriptors",
          url: "https://ielts.org/cdn/Guides/ielts-writing-band-descriptors.pdf",
        },
        {
          title: "IELTS Academic: Reading test format",
          url: "https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading",
        },
      ],
      exam: "IELTS Academic",
    },
  },
  {
    expected: {
      facts: [
        { kind: "testedLanguage", language: "en" },
        { kind: "scale", max: 90, min: 10 },
        { format: "multipleChoice", kind: "format", select: "all" },
        { format: "multipleChoice", kind: "format", partialCredit: "plusMinus", select: "all" },
      ],
    },
    id: "pte-academic",
    language: "en",
    userInput: {
      documents: [
        { title: "PTE Academic", url: "https://www.pearsonpte.com/pte-academic" },
        {
          title: "PTE Academic test format: Listening",
          url: "https://www.pearsonpte.com/pte-academic/test-format/listening",
        },
      ],
      exam: "PTE Academic",
    },
  },
  {
    expected: {
      facts: [
        { format: "multipleChoice", kind: "format", select: "all" },
        { format: "multipleChoice", kind: "format", partialCredit: "perOption", select: "all" },
        { entry: "decimals", format: "numeric", kind: "format" },
        { format: "numeric", kind: "format", share: 0.25 },
      ],
    },
    id: "jee-advanced-2026-paper-1",
    language: "en",
    userInput: {
      documents: [
        {
          title: "JEE (Advanced) 2026 Paper 1 (English)",
          url: "https://jeeadv.ac.in/documents/p1_english.pdf",
        },
      ],
      exam: "JEE Advanced 2026",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 120 },
        { kind: "section", minutes: 30, questions: 50 },
        { kind: "section", minutes: 29, questions: 47 },
        { kind: "section", minutes: 23, questions: 12 },
        { kind: "section", minutes: 8, questions: 11 },
      ],
    },
    id: "toefl-ibt",
    language: "en",
    userInput: {
      documents: [
        {
          title: "TOEFL iBT Test Content and Structure",
          url: "https://www.ets.org/toefl/test-takers/ibt/about/content.html",
        },
      ],
      exam: "TOEFL iBT",
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Língua Inglesa" },
        { kind: "choice", options: ["Espanhola", "Francesa"] },
      ],
    },
    id: "cacd-2025",
    language: "pt",
    userInput: {
      documents: [
        {
          text: [
            "EDITAL Nº 1, DE 14 DE MAIO DE 2025. CONCURSO DE ADMISSÃO À CARREIRA DE DIPLOMATA.",
            "O concurso será realizado em duas fases, ambas de responsabilidade do Cebraspe: Primeira Fase: prova objetiva, constituída de questões do tipo CERTO ou ERRADO de Língua Portuguesa, História do Brasil, História Mundial, Geografia, Língua Inglesa, Política Internacional, Economia e Direito, de caráter eliminatório; Segunda Fase: provas escritas de Língua Portuguesa, Língua Inglesa, História do Brasil, Política Internacional, Geografia, Economia, Direito e um idioma adicional (Língua Espanhola ou Língua Francesa), de caráter eliminatório e classificatório.",
            "No sistema de inscrição, o candidato deverá optar pela cidade de provas e pelo idioma adicional (Língua Espanhola ou Língua Francesa) para as provas escritas da Segunda Fase.",
            "A Segunda Fase consistirá das seguintes provas escritas: Prova | Duração | Tipo | Pontuação máxima. Língua Inglesa | 4 horas | Redação sobre tema geral, com extensão mínima de 65 linhas e máxima de 70 linhas | 70,00; Elaboração de um resumo, com extensão mínima de 15 linhas e máxima de 30 linhas | 30,00. Língua Espanhola | 4 horas | Elaboração de resumo, em espanhol, a partir de texto escrito em Língua Espanhola, com extensão mínima de 30 e máxima de 60 linhas, e de versão de um texto do português para o espanhol, com extensão mínima de 30 e máximo de 60 linhas. | 100,00. Língua Francesa | 4 horas | Elaboração de resumo, em francês, a partir de texto escrito em Língua Francesa, com extensão mínima de 30 e máxima de 60 linhas, e de versão de um texto do português para o francês, com extensão mínima de 30 e máximo de 60 linhas. | 100,00.",
          ].join("\n\n"),
          title: "Edital nº 1, de 14 de maio de 2025 (CACD 2025, Instituto Rio Branco)",
        },
      ],
      exam: "Concurso de Admissão à Carreira de Diplomata (CACD)",
    },
  },
  {
    expected: {
      facts: [
        { in: "mock", kind: "questionCount", value: 240 },
        { format: "trueFalse", kind: "format" },
        { kind: "wrongPenalty", value: 0.25 },
        { kind: "totalMinimum", minimum: { unit: "points", value: 120 } },
        { date: "2026-03-29", dateKind: "exam", kind: "date" },
        { date: "2026-04-25", dateKind: "exam", kind: "date" },
        { date: "2026-04-26", dateKind: "exam", kind: "date" },
        { date: "2026-05-02", dateKind: "exam", kind: "date" },
        { date: "2026-05-03", dateKind: "exam", kind: "date" },
        { day: 1, kind: "section", minutes: 210 },
        { day: 2, kind: "section", minutes: 240, name: "Língua Portuguesa" },
        { day: 2, kind: "section", minutes: 300, name: "História do Brasil" },
        { day: 3, kind: "section", minutes: 240, name: "Língua Inglesa" },
        { day: 3, kind: "section", minutes: 300, name: "Geografia" },
        { day: 4, kind: "section", minutes: 300, name: "Política Internacional" },
        { day: 4, kind: "section", minutes: 300, name: "Economia" },
        { day: 5, kind: "section", minutes: 300, name: "Direito" },
        {
          count: 1,
          kind: "writtenTask",
          language: { factor: 0.5, method: "perError" },
          lines: 70,
          points: 70,
        },
        { count: 1, kind: "writtenTask", lines: 30, points: 30 },
        { count: 2, kind: "writtenTask", lines: 60, points: 30 },
        { count: 2, kind: "writtenTask", lines: 40, points: 20 },
        { count: 1, kind: "writtenTask", lines: 60, points: 50 },
      ],
    },
    id: "cacd-2026-full-notice",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1, de 28 de janeiro de 2026 (CACD 2026, Instituto Rio Branco)",
          url: "https://cdn.cebraspe.org.br/concursos/irbr_26_diplomacia/arquivos/7FA89C5320E2811FDD1A8276DD6526120704864996EA8C6DED7A6DDB5D0987D7.pdf",
        },
      ],
      exam: "Concurso de Admissão à Carreira de Diplomata (CACD)",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 70 },
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
      ],
      usable: false,
    },
    id: "tjsp-escrevente-2025-news-page",
    language: "pt",
    userInput: {
      documents: [
        {
          title:
            "TJSP publica edital de abertura de concurso para escrevente técnico judiciário na Capital e CJs da 1ª RAJ",
          url: "https://www.tjsp.jus.br/Noticias/Noticia?codigoNoticia=108814",
        },
      ],
      exam: "Concurso TJ-SP, Escrevente Técnico Judiciário",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 70 },
        { kind: "subject", name: "Língua Portuguesa", questions: 16 },
        { kind: "subject", name: "Direito", questions: 30 },
        { kind: "subject", name: "Informática", questions: 9 },
        { kind: "subject", name: "Raciocínio Lógico", questions: 7 },
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "scale", max: 10, min: 0 },
        { date: "2025-12-07", kind: "date" },
      ],
      usable: true,
    },
    id: "tjsp-escrevente-2025-notice-copy",
    language: "pt",
    userInput: {
      documents: [
        {
          title:
            "TJSP publica edital de abertura de concurso para escrevente técnico judiciário na Capital e CJs da 1ª RAJ",
          url: "https://www.tjsp.jus.br/Noticias/Noticia?codigoNoticia=108814",
        },
        {
          title: "Edital TJ SP Escrevente 2025",
          url: "https://blog-static.infra.grancursosonline.com.br/wp-content/uploads/2025/08/01003721/edital-tj-sp-2025.pdf",
        },
      ],
      exam: "Concurso TJ-SP, Escrevente Técnico Judiciário",
    },
  },
  {
    expected: {
      facts: [
        { kind: "choice", options: ["Historia de España", "Filosofía"] },
        { kind: "choice", options: ["alemán", "francés", "inglés", "italiano", "portugués"] },
      ],
    },
    id: "pau-spain-ciencias",
    language: "es",
    userInput: {
      documents: [
        {
          title: "Real Decreto 534/2024 (prueba de acceso a la universidad), texto consolidado",
          url: "https://www.boe.es/buscar/act.php?id=BOE-A-2024-11858",
        },
      ],
      exam: "Prueba de Acceso a la Universidad (PAU), modalidad de Ciencias y Tecnología",
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Comprensión lectora", questions: 30 },
        { kind: "subject", name: "Redacción indirecta", questions: 30 },
        { kind: "subject", name: "Pensamiento matemático", questions: 30 },
        {
          kind: "choice",
          options: ["Administración", "Biología", "Derecho", "Premedicina", "Química"],
          take: 2,
        },
      ],
    },
    id: "exani-ii-modules",
    language: "es",
    userInput: {
      documents: [
        {
          title: "Guía para el sustentante EXANI-II",
          url: "https://ingreso.uady.mx/licenciatura/docs/2_EXANI_II_guia_sustente_2023.pdf",
        },
      ],
      exam: "EXANI-II",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-04-02", dateKind: "exam", kind: "date" },
        { date: "2027-05-22", dateKind: "exam", kind: "date" },
        { date: "2027-07-09", dateKind: "exam", kind: "date" },
        { date: "2027-10-15", dateKind: "exam", kind: "date" },
        { date: "2027-11-13", dateKind: "exam", kind: "date" },
        { date: "2027-02-10", dateKind: "registrationEnd", kind: "date" },
        { kind: "testedLanguage", language: "es" },
      ],
    },
    id: "dele-b2-sittings",
    language: "es",
    userInput: {
      documents: [
        { title: "Cuándo es el DELE", url: "https://examenes.cervantes.es/es/dele/cuando" },
        {
          title: "Guía de examen DELE B2",
          url: "https://examenes.cervantes.es/sites/default/files/guia_examen_dele_b2_0.pdf",
        },
      ],
      exam: "DELE B2",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-04-27", dateKind: "exam", kind: "date" },
        { date: "2027-05-05", dateKind: "exam", kind: "date" },
        { date: "2027-04-30", dateKind: "exam", kind: "date" },
      ],
    },
    id: "abitur-bayern-2027",
    language: "de",
    userInput: {
      documents: [
        {
          title: "Prüfungen und Zeugnisse (Termine)",
          url: "https://www.km.bayern.de/termine/pruefungen-und-zeugnisse",
        },
      ],
      exam: "Abitur Bayern 2027",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-06-14", dateKind: "exam", kind: "date" },
        { date: "2027-06-15", dateKind: "exam", kind: "date" },
        { date: "2027-07-06", dateKind: "results", kind: "date" },
      ],
    },
    id: "bac-2027",
    language: "fr",
    userInput: {
      documents: [
        { title: "Dates du bac 2027", url: "https://www.letudiant.fr/bac/date-du-bac.html" },
      ],
      exam: "Baccalauréat général 2027",
    },
  },
  {
    expected: {
      facts: [
        { format: "shortAnswer", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "shortTopics" },
      ],
      usable: true,
    },
    id: "pt-class-notes-biologia-celular",
    language: "pt",
    userInput: {
      documents: [
        {
          text: 'BIOLOGIA - 1º ANO B - Prof.ª Juliana\nResumo pra prova de sexta (9/10): A CÉLULA\n\n1) Teoria celular\n- Todo ser vivo é formado por células (exceto vírus!)\n- A célula é a menor unidade da vida\n- Toda célula vem de outra célula (Virchow)\n- Hooke viu as "celas" na cortiça (1665)\n\n2) Procarionte x eucarionte\n- Procarionte: sem núcleo (DNA solto no citoplasma = nucleoide), sem organelas membranosas. Ex: bactérias\n- Eucarionte: núcleo com carioteca + organelas. Ex: animais, plantas, fungos, protozoários\n- As duas têm: membrana plasmática, citoplasma, ribossomos, DNA\n\n3) Membrana plasmática\n- Bicamada de fosfolipídios + proteínas (mosaico fluido)\n- Permeabilidade seletiva\n- Transporte passivo (sem gasto de ATP): difusão simples, difusão facilitada, osmose\n- Osmose: água vai do meio hipotônico (menos concentrado) para o hipertônico (mais concentrado)\n- Hemácia em água pura incha e estoura (hemólise); em solução muito salgada murcha\n- Transporte ativo: gasta ATP, contra o gradiente. Ex: bomba de sódio e potássio\n- Endocitose (fagocitose e pinocitose) e exocitose\n\n4) Organelas (CAI MUITO!!)\n- Mitocôndria: respiração celular, produz ATP\n- Cloroplasto: fotossíntese (só em plantas e algas)\n- Ribossomos: síntese de proteínas\n- RE rugoso: tem ribossomos, faz proteínas / RE liso: lipídios, desintoxicação\n- Complexo golgiense: modifica, empacota e secreta\n- Lisossomo: digestão intracelular\n- Vacúolo: grande na célula vegetal\n- Parede celular: célula vegetal (celulose)\n\n5) Núcleo\n- Carioteca (envoltório nuclear com poros)\n- Cromatina = DNA + proteínas\n- Nucléolo: produz ribossomos\n\n6) Vírus\n- Acelulares, só se reproduzem dentro de células (parasitas intracelulares obrigatórios)\n- Capsídeo de proteína + material genético (DNA ou RNA)\n- Antibiótico NÃO funciona contra vírus\n\nA prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!',
          title: "Resumo pra prova de biologia",
        },
      ],
      exam: "Prova de biologia (1º ano), a célula",
      material: true,
    },
  },
  {
    expected: {
      facts: [
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "shortTopics" },
      ],
      usable: true,
    },
    id: "en-class-notes-ap-biology-unit-2",
    language: "en",
    userInput: {
      documents: [
        {
          text: "AP Biology - Mr. Daniels - Unit 2 review (test on Thursday)\n\n1. Cell size and surface area-to-volume ratio\n- Smaller cells exchange materials faster: higher SA:V\n- Calculate SA:V for a cube (side 1 cm vs 3 cm)\n\n2. Membrane structure\n- Phospholipid bilayer, fluid mosaic model\n- Cholesterol keeps the membrane fluid at low temperatures\n\n3. Membrane transport\n- Passive: simple diffusion, facilitated diffusion, osmosis\n- Tonicity: hypotonic, isotonic, hypertonic solutions\n- Active transport uses ATP (sodium-potassium pump)\n\n4. Compartmentalization\n- Endomembrane system: ER, Golgi, lysosomes\n- Endosymbiotic theory (mitochondria and chloroplasts)\n\nTest format: 20 multiple choice questions (four choices each) plus one free-response essay where you design an experiment on osmosis in potato cores. Calculators allowed.",
          title: "Unit 2 review",
        },
      ],
      exam: "AP Biology unit 2 test",
      material: true,
    },
  },
  {
    expected: {
      facts: [
        { kind: "topic", topic: "Velocidade média" },
        { kind: "topic", topic: "Aceleração" },
        { kind: "topic", topic: "Função horária" },
        { kind: "shortTopics" },
      ],
      usable: true,
    },
    id: "pt-photo-notes-transcript-with-latex",
    language: "pt",
    userInput: {
      documents: [
        {
          text: String.raw`# Cinemática - MUV

Velocidade média: $v_m = \Delta s / \Delta t$

Aceleração: $a = \Delta v / \Delta t$ (unidade: $m/s^2$)

Função horária: $s = s_0 + v_0 \cdot t + a \cdot t^2 / 2$

Ex.: $s = 12 - 3,5 \cdot t$ → $v_0 = -3,5$ m/s

(movimento retrógrado)

Freando: $a = -2,5$ m/s² (sinal contrário ao de v)

Mov. uniformemente variado: $a$ constante $\neq 0$

Exercício 4: um carro a 20 m/s freia com $a = -2,5$ m/s². Em quanto tempo ele para?`,
          title: "Foto das anotações de física",
        },
      ],
      exam: "Prova de física (1º ano), cinemática",
      material: true,
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Electricity" },
        { kind: "topic", subject: "Electricity", topic: "Current" },
        { kind: "topic", subject: "Electricity", topic: "Ohm's law" },
        { kind: "topic", subject: "Electricity", topic: "Power" },
        { kind: "topic", subject: "Electricity", topic: "Series circuit" },
        { kind: "shortTopics" },
      ],
      usable: true,
    },
    id: "en-photo-notes-under-one-title",
    language: "en",
    userInput: {
      documents: [
        {
          text: String.raw`# Electricity - circuits

Current: $I = Q / t$ (unit: ampere)

Ohm's law: $V = I \cdot R$

Ex.: $R = 6\,\Omega$, $I = 2$ A → $V = 12$ V

Power: $P = V \cdot I$

Series circuit: same current through every resistor, $R_{total} = R_1 + R_2$

Q3: a 9 V battery drives 0.5 A. What is the resistance?`,
          title: "Photo of physics notes",
        },
      ],
      exam: "Physics test on circuits",
      material: true,
    },
  },
  {
    expected: {
      facts: [
        { kind: "topic", topic: "Boyle's law" },
        { kind: "topic", topic: "Charles's law" },
        { kind: "topic", topic: "Ideal gas law" },
        { kind: "shortTopics" },
      ],
      usable: true,
    },
    id: "en-typed-notes-with-formulas-and-a-worked-example",
    language: "en",
    userInput: {
      documents: [
        {
          text: "Chem quiz Friday - gas laws\n\nBoyle's law: P1V1 = P2V2 (constant T)\nCharles's law: V1/T1 = V2/T2, T in kelvin!\nIdeal gas law: PV = nRT, R = 0.0821 L·atm/(mol·K)\nEx: 2.0 mol at 300 K in 10 L -> P = (2.0)(0.0821)(300)/10 = 4.9 atm\nSTP: 0 °C and 1 atm, 1 mol of gas = 22.4 L\nPractice 3: a balloon goes from 2.0 L at 25 °C to 50 °C. New volume?",
          title: "Gas laws notes",
        },
      ],
      exam: "Chemistry quiz on gas laws",
      material: true,
    },
  },
];
