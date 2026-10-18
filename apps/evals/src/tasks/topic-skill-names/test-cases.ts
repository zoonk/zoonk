import { type TestCase } from "@/lib/types";
import {
  type TopicSkillNamesInput,
  type TopicToName,
} from "@zoonk/ai/tasks/v2/plans/topic-skill-names";
import { type TopicSkillNamesExpected } from "./scorer";

type TopicSkillNamesTestCase = TestCase<TopicSkillNamesExpected, TopicSkillNamesInput>;

type TopicCase = TopicToName & { general: string[]; personal: string[] };

function namesCase({
  id,
  language,
  topics,
}: {
  id: string;
  language: string;
  topics: TopicCase[];
}): TopicSkillNamesTestCase {
  return {
    expected: { topics: topics.map(({ general, personal }) => ({ general, personal })) },
    id: `${language}-${id}`,
    userInput: {
      language,
      topics: topics.map(({ description, name, subject }) => ({ description, name, subject })),
    },
  };
}

/**
 * Topics as plan-edit-intent writes them from the learner's words, some with the learner's own
 * details (persona pass 9: Pedro's teacher's table, Carla's school, Marcos's interview), and one
 * already generic, which keeps its subject.
 */
export const TEST_CASES: TopicSkillNamesTestCase[] = [
  namesCase({
    id: "class-test-teacher",
    language: "pt",
    topics: [
      {
        description: "A tabela que a Profa. Ana pediu para a prova de sexta.",
        general: ["organela"],
        name: "Completar a tabela das organelas para a prova da Profa. Ana",
        personal: ["Ana", "Profa", "sexta"],
        subject: "Biologia Celular",
      },
    ],
  }),
  namesCase({
    id: "career-own-school",
    language: "pt",
    topics: [
      {
        description:
          "Um projeto de portfólio sobre a Escola Estadual Pedro II, onde dou aula de história.",
        general: ["estudo de caso", "portfolio"],
        name: "Conduzir um estudo de caso de UX na Escola Estadual Pedro II, onde dou aula",
        personal: ["Pedro II", "Escola Estadual", "dou aula", "historia"],
        subject: "Portfólio de UX",
      },
    ],
  }),
  namesCase({
    id: "interview-company",
    language: "pt",
    topics: [
      {
        description: "Explicar em inglês as consultas que faço no Nubank, para a entrevista.",
        general: ["SQL"],
        name: "Explicar consultas SQL em inglês na entrevista do Nubank",
        personal: ["Nubank"],
        subject: "Inglês para entrevistas",
      },
    ],
  }),
  namesCase({
    id: "prep-course-essay",
    language: "pt",
    topics: [
      {
        description: "O tema que o cursinho Anglo deu na semana passada: mobilidade urbana.",
        general: ["mobilidade urbana", "redacao"],
        name: "Redação do cursinho Anglo sobre mobilidade urbana",
        personal: ["Anglo", "cursinho", "semana passada"],
        subject: "Redação",
      },
    ],
  }),
  namesCase({
    id: "already-generic",
    language: "pt",
    topics: [
      {
        description: "Calcular montantes com juros compostos em questões de prova.",
        general: ["juros compostos"],
        name: "Resolver questões de juros compostos",
        personal: [],
        subject: "Matemática",
      },
    ],
  }),
  namesCase({
    id: "field-topics-manager",
    language: "en",
    topics: [
      {
        description: "Write the SQL queries my team at Acme runs every Monday.",
        general: ["SQL"],
        name: "Write SQL queries for Acme's Monday report",
        personal: ["Acme", "Monday"],
        subject: "English for data work",
      },
      {
        description: "Build the dashboards Jenny reviews in our weekly sales meeting.",
        general: ["dashboard"],
        name: "Build dashboards for Jenny's weekly sales review",
        personal: ["Jenny"],
        subject: "English for data work",
      },
      {
        description: "Give status updates to my manager Tom without freezing.",
        general: ["update", "stakeholder", "status"],
        name: "Give stakeholder updates to my manager Tom",
        personal: ["Tom"],
        subject: null,
      },
    ],
  }),
  namesCase({
    id: "university-course-code",
    language: "en",
    topics: [
      {
        description: "The eigenvalue problems from Prof. Kim's MATH 221 problem set due Oct 14.",
        general: ["eigenvalue"],
        name: "Solve the eigenvalue problems for MATH 221 at UBC",
        personal: ["Kim", "MATH 221", "UBC", "Oct 14"],
        subject: "Linear algebra",
      },
    ],
  }),
];
