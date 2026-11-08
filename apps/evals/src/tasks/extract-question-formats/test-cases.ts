import { type TestCase } from "@/lib/types";
import { type FormatsEvalInput } from "./generate";
import { type FormatsExpected } from "./task";

type FormatsCase = TestCase<FormatsExpected, FormatsEvalInput>;

export const TEST_CASES: FormatsCase[] = [
  {
    expected: {
      absent: [],
      present: [
        { kind: "multipleChoice", section: /^Paper 1$/u },
        { kind: "essay", section: null },
      ],
    },
    id: "en-valid-mixed-known-and-unknown-scope",
    userInput: {
      documents: [
        {
          text: "Paper 1 has multiple-choice questions with four options. There will also be an essay; this announcement does not state which paper contains the essay.",
          title: "Exam announcement",
        },
      ],
      exam: "School exam",
      parts: ["Paper 1", "Paper 2"],
    },
  },
  {
    expected: {
      absent: [{ kind: "numeric", section: /^Section A$/u }],
      present: [
        { kind: "multipleChoice", options: 4, section: null, select: null },
        { kind: "numeric", section: /^Section B$/u },
      ],
    },
    id: "en-jee-choice-everywhere-numeric-section-b",
    userInput: {
      documents: [
        {
          text: "The JEE-style practice test has Section A and Section B. In both Section A and Section B, multiple-choice questions offer four options; select one answer. Section B also contains numerical-value questions: type an integer answer.",
          title: "Practice test directions",
        },
      ],
      exam: "JEE-style practice test",
      parts: ["Section A", "Section B"],
    },
  },
  {
    expected: {
      absent: [
        { kind: "multipleChoice", passage: /column/iu, select: "all" },
        { description: /grid|circle/iu, kind: "numeric" },
        { kind: "multipleChoice", passage: /column|blank/iu, section: /^Quantitative/u },
        { kind: "multipleChoice", options: 4, section: /^Verbal/u },
      ],
      present: [
        { kind: "essay" },
        { kind: "multipleChoice", options: 4, section: /^Quantitative/u, select: null },
        { kind: "multipleChoice", options: 5, select: null },
        { kind: "multipleChoice", passage: /column|blank/iu, section: /^Verbal/u, select: null },
        { kind: "multipleChoice", options: 6, section: /^Verbal/u, select: 2 },
        { kind: "multipleChoice", select: "all" },
        { kind: "numeric", section: /^Quantitative/u },
      ],
    },
    id: "en-gre-general-test",
    userInput: {
      documents: [
        {
          title: "GRE General Test Structure",
          url: "https://www.ets.org/gre/test-takers/general-test/prepare/test-structure.html",
        },
        {
          title: "Practice Book for the Paper-delivered GRE General Test",
          url: "https://www.ets.org/content/dam/ets-india/pdfs/gre/paper-delivered-test-practice-book.pdf",
        },
      ],
      exam: "GRE General Test",
      parts: [
        "Analytical Writing",
        "Verbal Reasoning (Section 1)",
        "Verbal Reasoning (Section 2)",
        "Quantitative Reasoning (Section 1)",
        "Quantitative Reasoning (Section 2)",
        "Verbal Reasoning",
        "Quantitative Reasoning",
      ],
    },
  },
  {
    expected: {
      absent: [{ kind: "multipleChoice" }],
      present: [{ kind: "shortAnswer" }, { kind: "essay" }],
    },
    id: "pt-class-notes-in-passing",
    userInput: {
      documents: [
        {
          text: "Geografia – Climas do Brasil\n\nO clima equatorial é quente e úmido o ano todo. O semiárido tem chuvas escassas e mal distribuídas, e o subtropical tem as quatro estações bem definidas.\n\nMassas de ar: a Equatorial Continental traz umidade para o interior no verão, e a Polar Atlântica traz as frentes frias.\n\nAvisos: trabalho em dupla até quarta. Na avaliação de sexta, o professor disse que vai pedir para legendar o mapa dos climas e escrever um texto explicando a seca no semiárido.",
          title: "Anotações de geografia",
        },
      ],
      exam: "Avaliação de geografia",
    },
  },
  {
    expected: {
      absent: [{ kind: "essay" }],
      present: [
        { kind: "multipleChoice", options: 4, section: null, select: null },
        { kind: "multipleChoice", options: 4, section: null, select: "all" },
        { kind: "numeric", section: null },
      ],
    },
    id: "en-jee-advanced-2026-paper-1",
    userInput: {
      documents: [
        {
          title: "JEE (Advanced) 2026 Paper 1 (English)",
          url: "https://jeeadv.ac.in/documents/p1_english.pdf",
        },
      ],
      exam: "JEE (Advanced) 2026, Paper 1",
      parts: ["Physics", "Chemistry", "Mathematics"],
    },
  },
  {
    // The notice covers every role: Registro e Redação writes two discursive questions and a
    // technical piece, while the engineers write three questions.
    expected: {
      absent: [{ kind: "multipleChoice" }],
      present: [
        { kind: "trueFalse" },
        { description: /quest/iu, kind: "essay" },
        { description: /peça/iu, kind: "essay" },
      ],
    },
    id: "pt-camara-2026-registro-redacao",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – Câmara dos Deputados, de 2 de outubro de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/CD_26_ANALISTA/arquivos/BBE30D016054F40651E36AC7B302C3425BD148A39675CA840A5A0CCBFBB5F0F1.pdf",
        },
      ],
      exam: "Concurso da Câmara dos Deputados, Analista Legislativo – Registro e Redação",
    },
  },
  {
    // The notice also sets the second phase's piece and discursive questions, which aren't this
    // test's formats.
    expected: {
      absent: [{ kind: "essay" }],
      present: [{ kind: "multipleChoice", options: 4, select: null }],
    },
    id: "pt-oab-48-1a-fase",
    userInput: {
      documents: [
        {
          title: "Edital de abertura do 48º Exame de Ordem Unificado",
          url: "https://s.oab.org.br/arquivos/2026/09/fb43fb37-838e-4d33-a863-99fa1f98b921.pdf",
        },
      ],
      exam: "48º Exame de Ordem Unificado, 1ª fase",
    },
  },
];
