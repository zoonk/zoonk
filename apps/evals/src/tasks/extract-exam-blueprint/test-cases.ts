import { type TestCase } from "@/lib/types";
import { type ExtractionEvalInput } from "./generate";
import { type ExtractionExpected } from "./task";

/**
 * Real notices with a current edition on 26 Sep 2026 (OAB, AP, IELTS and TOEFL
 * read on 27 Sep 2026, the SAT dates page on 30 Sep 2026). Facts were read by hand
 * from the same documents. education.gouv.fr refuses automated fetches, so the bac
 * case reads a secondary page that reproduces the official calendar.
 */
export const TEST_CASES: TestCase<ExtractionExpected, ExtractionEvalInput>[] = [
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 180 },
        { date: "2026-11-08", dateKind: "exam", kind: "date" },
        { date: "2026-11-15", dateKind: "exam", kind: "date" },
        { date: "2026-06-05", dateKind: "registrationEnd", kind: "date" },
        { kind: "subject", name: "Linguagens", questions: 45 },
        { kind: "subject", name: "Matemática", questions: 45 },
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "scoring", method: "itemResponseTheory" },
        { kind: "timeLimit", minutes: 330 },
        { kind: "timeLimit", minutes: 300 },
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
        { kind: "questionCount", value: 150 },
        { kind: "section", questions: 35 },
        { kind: "section", questions: 45 },
        { kind: "section", questions: 70 },
        { format: "trueFalse", kind: "format" },
        { kind: "scoring", method: "wrongCancelsRight" },
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
        { kind: "questionCount", value: 98 },
        { kind: "section", minutes: 64, questions: 54 },
        { kind: "section", minutes: 70, questions: 44 },
        { kind: "timeLimit", minutes: 134 },
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
          // Its dates are table rows: a row alone doesn't say which date is the test's.
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
        { format: "essay", kind: "format" },
        { format: "oral", kind: "format" },
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
];
