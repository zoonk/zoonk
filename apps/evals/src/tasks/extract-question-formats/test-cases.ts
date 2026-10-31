import { type TestCase } from "@/lib/types";
import { type FormatsEvalInput } from "./generate";
import { type FormatsExpected } from "./task";

type FormatsCase = TestCase<FormatsExpected, FormatsEvalInput>;

export const TEST_CASES: FormatsCase[] = [
  {
    expected: {
      absent: [{ kind: "numeric", section: "Section A" }],
      present: [
        { kind: "multipleChoice", options: 4, section: "Section A", select: null },
        { kind: "multipleChoice", options: 4, section: "Section B", select: null },
        { kind: "numeric", section: "Section B" },
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
    },
  },
  {
    expected: {
      absent: [
        { kind: "multipleChoice", passage: /column/iu, select: "all" },
        { description: /grid|circle/iu, kind: "numeric" },
      ],
      present: [
        { kind: "essay" },
        { kind: "multipleChoice", options: 4, section: "quantitative", select: null },
        { kind: "multipleChoice", options: 5, select: null },
        { kind: "multipleChoice", passage: /column|blank/iu, section: "verbal", select: null },
        { kind: "multipleChoice", options: 6, section: "verbal", select: 2 },
        { kind: "multipleChoice", select: "all" },
        { kind: "numeric", section: "quantitative" },
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
];
