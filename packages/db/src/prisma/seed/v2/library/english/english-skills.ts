import { pt } from "../../_utils/localize";
import { skill } from "../content";

/**
 * "I can" skills for English as used in real situations, from arriving at the airport to making
 * friends. The course is for Portuguese speakers, so only the Portuguese text is stored.
 */
export const englishSkills = [
  skill("explain-visit", "beginner", {
    description: pt("Dizer por que você está no país e por quanto tempo."),
    name: pt("Explicar o motivo da viagem na imigração"),
  }),
  skill("airport-directions", "beginner", {
    description: pt("Perguntar onde ficam as coisas e entender a resposta."),
    name: pt("Pedir informações no aeroporto"),
  }),
  skill(
    "ask-rent",
    "beginner",
    {
      description: pt("Perguntar o preço com “How much is…?” e o que ele inclui."),
      example: pt("How much is the rent? Are utilities included?"),
      name: pt("Perguntar quanto é o aluguel"),
    },
    { prerequisites: ["airport-directions"] },
  ),
  skill("rental-words", "beginner", {
    description: pt(
      "Rent é o aluguel, landlord é o proprietário, deposit é a caução e lease é o contrato.",
    ),
    example: pt(
      "The landlord asked for one month's rent as a deposit: o proprietário pediu um mês de aluguel de caução.",
    ),
    name: pt("Usar as palavras do aluguel"),
  }),
  skill(
    "there-is-are",
    "beginner",
    {
      description: pt(
        "Quando “tem” quer dizer “existe”, o inglês usa there is (uma coisa) ou there are (várias).",
      ),
      example: pt(
        "There are two bedrooms and there is a small balcony: tem dois quartos e uma varanda pequena.",
      ),
      name: pt("Descrever um lugar com there is e there are"),
    },
    { prerequisites: ["rental-words"] },
  ),
  skill("apartment-rooms", "beginner", {
    description: pt("Nomear os cômodos da casa: bedroom, bathroom, kitchen, living room."),
    example: pt("A one-bedroom tem quarto, banheiro, cozinha e sala."),
    name: pt("Nomear os cômodos de um apartamento"),
  }),
  skill(
    "book-viewing",
    "beginner",
    {
      description: pt("Pedir para ver um imóvel e combinar dia e horário."),
      name: pt("Marcar uma visita ao apartamento"),
    },
    { prerequisites: ["ask-rent"] },
  ),
  skill(
    "lease-terms",
    "beginner",
    {
      description: pt("Entender quanto dura o contrato e o que ele proíbe."),
      name: pt("Entender um contrato de aluguel"),
    },
    { prerequisites: ["rental-words"] },
  ),
  skill("open-account", "beginner", {
    description: pt("Abrir uma conta no banco e perguntar sobre tarifas."),
    name: pt("Abrir uma conta no banco"),
  }),
  skill("phone-plan", "beginner", {
    description: pt("Escolher um plano de celular e resolver um problema por telefone."),
    name: pt("Resolver o plano de celular"),
  }),
  skill("introduce-at-work", "intermediate", {
    description: pt("Se apresentar e falar da sua função para uma equipe nova."),
    name: pt("Se apresentar no trabalho"),
  }),
  skill(
    "follow-meeting",
    "intermediate",
    {
      description: pt("Acompanhar uma reunião e pedir para repetirem ou explicarem."),
      name: pt("Acompanhar uma reunião"),
    },
    { prerequisites: ["introduce-at-work"] },
  ),
  skill("describe-symptoms", "intermediate", {
    description: pt("Explicar como você está se sentindo e desde quando."),
    name: pt("Descrever como você está se sentindo"),
  }),
  skill(
    "pharmacy",
    "intermediate",
    {
      description: pt("Pedir um remédio e entender como tomar."),
      name: pt("Comprar remédio na farmácia"),
    },
    { prerequisites: ["describe-symptoms"] },
  ),
  skill("small-talk", "intermediate", {
    description: pt("Conversar sobre o tempo, o fim de semana e o bairro."),
    name: pt("Puxar conversa com os vizinhos"),
  }),
  skill(
    "make-plans",
    "intermediate",
    {
      description: pt("Convidar alguém e combinar um programa."),
      name: pt("Combinar um programa com amigos"),
    },
    { prerequisites: ["small-talk"] },
  ),
];
