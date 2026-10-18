import { pt } from "../../_utils/localize";
import { outlineLesson } from "../content";
import { type SeedChapter } from "../types";
import { howMuchIsTheRentLesson } from "./lessons/how-much-is-the-rent";
import { thereIsThereAreLesson } from "./lessons/there-is-there-are";

function unit(
  key: string,
  text: { title: string; description: string; objectives: string[] },
  level: SeedChapter["level"],
  lessons: SeedChapter["lessons"],
): SeedChapter {
  return {
    description: pt(text.description),
    key,
    lessons,
    level,
    objectives: text.objectives.map((objective) => pt(objective)),
    title: pt(text.title),
  };
}

function lesson(key: string, title: string, description: string, skills: string[]) {
  return outlineLesson(key, { description: pt(description), title: pt(title) }, skills, 6);
}

/** Units are real situations, each closing with "I can" checks and a conversation. */
export const englishUnits: SeedChapter[] = [
  unit(
    "arriving",
    {
      description: "O que dizer do avião até a saída do aeroporto.",
      objectives: [
        "Consigo explicar por que estou no Canadá",
        "Consigo pedir informações no aeroporto",
      ],
      title: "Chegando: aeroporto e imigração",
    },
    "beginner",
    [
      lesson(
        "at-immigration",
        "Na imigração",
        "As perguntas do agente e respostas curtas e claras.",
        ["explain-visit"],
      ),
      lesson(
        "finding-your-way",
        "Achando o caminho",
        "Onde fica a esteira, o táxi e o trem para a cidade.",
        ["airport-directions"],
      ),
    ],
  ),
  unit(
    "renting",
    {
      description: "Da primeira ligação sobre o anúncio até a assinatura do contrato.",
      objectives: [
        "Consigo perguntar o preço do aluguel e as regras",
        "Consigo descrever um apartamento",
        "Consigo marcar uma visita",
      ],
      title: "Alugando um apartamento",
    },
    "beginner",
    [
      howMuchIsTheRentLesson,
      thereIsThereAreLesson,
      lesson(
        "book-a-viewing",
        "Marcando uma visita",
        "Como pedir para ver o apartamento e combinar o horário.",
        ["book-viewing"],
      ),
      lesson(
        "reading-the-lease",
        "Lendo o contrato",
        "Prazo, reajuste e o que o contrato proíbe.",
        ["lease-terms"],
      ),
    ],
  ),
  unit(
    "bank-phone",
    {
      description: "Conta no banco, cartão e plano de celular.",
      objectives: ["Consigo abrir uma conta e resolver problemas"],
      title: "Banco e celular",
    },
    "beginner",
    [
      lesson(
        "opening-an-account",
        "Abrindo uma conta",
        "Os documentos, as tarifas e as perguntas do gerente.",
        ["open-account"],
      ),
      lesson(
        "phone-plan",
        "Resolvendo o plano de celular",
        "Escolher um plano e reclamar de uma cobrança.",
        ["phone-plan"],
      ),
    ],
  ),
  unit(
    "first-week-at-work",
    {
      description: "Apresentações, reuniões e o inglês do dia a dia no escritório.",
      objectives: ["Consigo conhecer a equipe e acompanhar reuniões"],
      title: "Primeira semana no trabalho",
    },
    "intermediate",
    [
      lesson("meet-the-team", "Conhecendo a equipe", "Como se apresentar e falar da sua função.", [
        "introduce-at-work",
      ]),
      lesson("in-a-meeting", "Numa reunião", "Pedir para repetir sem ficar sem graça.", [
        "follow-meeting",
      ]),
    ],
  ),
  unit(
    "doctor-pharmacy",
    {
      description: "Explicar sintomas e entender a receita.",
      objectives: ["Consigo explicar como estou me sentindo"],
      title: "Médico e farmácia",
    },
    "intermediate",
    [
      lesson("at-the-doctor", "No médico", "Dizer o que dói e desde quando.", [
        "describe-symptoms",
      ]),
      lesson("at-the-pharmacy", "Na farmácia", "Pedir um remédio e entender a dose.", ["pharmacy"]),
    ],
  ),
  unit(
    "social-life",
    {
      description: "Conversa com vizinhos, colegas e novos amigos.",
      objectives: ["Consigo conversar com vizinhos e colegas"],
      title: "Vida social",
    },
    "intermediate",
    [
      lesson("small-talk", "Puxando conversa", "O tempo, o fim de semana e o bairro.", [
        "small-talk",
      ]),
      lesson("making-plans", "Combinando um programa", "Convidar, aceitar e remarcar.", [
        "make-plans",
      ]),
    ],
  ),
];
