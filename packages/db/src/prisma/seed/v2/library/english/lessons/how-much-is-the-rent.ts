import { pt } from "../../../_utils/localize";
import { guess } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Unit "Renting an apartment", lesson 1: the words and the question learners need on their first
 * call to a landlord, with the how much/how many trap Portuguese speakers fall into.
 */
export const howMuchIsTheRentLesson: SeedLesson = {
  canDo: pt("Você vai perguntar quanto é o aluguel e o que ele inclui."),
  description: pt("As palavras e perguntas da sua primeira ligação sobre um apartamento."),
  key: "how-much-is-the-rent",
  minutes: 7,
  sentences: [
    {
      distractors: ["is", "include"],
      explanation: pt(
        "Em perguntas com to be, o verbo vem antes: utilities are vira are utilities.",
      ),
      sentence: "Are utilities included?",
      translation: pt("As contas estão incluídas?"),
      translationDistractors: [pt("aluguel"), pt("pagas")],
    },
    {
      distractors: ["yet", "free"],
      explanation: pt("Still vem antes do adjetivo: still available, ainda disponível."),
      sentence: "Is the apartment still available?",
      translation: pt("O apartamento ainda está disponível?"),
      translationDistractors: [pt("já"), pt("livre")],
    },
  ],
  skills: ["ask-rent", "rental-words"],
  steps: [
    {
      content: {
        options: [
          guess("much", pt("How much is the rent?"), true),
          guess("many", pt("How many is the rent?")),
          guess("costs", pt("What costs the rent?")),
        ],
        question: pt(
          "Você liga por causa de um apartamento em Toronto. Qual frase pergunta quanto é o aluguel?",
        ),
        reveal: pt(
          "“How much is the rent?” How much é para preço e para o que não se conta; how many é para o que se conta.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    { content: {}, kind: "vocabulary", skill: "rental-words", word: "rent" },
    { content: {}, kind: "vocabulary", skill: "rental-words", word: "landlord" },
    { content: {}, kind: "vocabulary", skill: "rental-words", word: "deposit" },
    {
      content: {
        pairs: [
          { left: "rent", right: pt("aluguel") },
          { left: "landlord", right: pt("proprietário") },
          { left: "deposit", right: pt("caução") },
          { left: "utilities", right: pt("contas de água, luz e gás") },
          { left: "lease", right: pt("contrato de aluguel") },
        ],
        question: pt("Ligue cada palavra ao significado"),
      },
      kind: "matchColumns",
      skill: "rental-words",
    },
    {
      content: {
        text: pt(
          "Em português, “quanto” serve para tudo. Em inglês, depende:\n\n- **How much** para preço e para o que não se conta: *How much is the rent?*\n- **How many** para o que se conta: *How many bedrooms are there?*",
        ),
        title: pt("How much ou how many?"),
      },
      kind: "explanation",
      skill: "ask-rent",
    },
    {
      content: {
        answers: ["much"],
        distractors: ["many", "cost"],
        feedback: pt("A caução é um preço, então é how much."),
        question: pt("Complete a pergunta"),
        template: "How [BLANK] is the deposit?",
      },
      kind: "fillBlank",
      skill: "ask-rent",
    },
    { content: {}, kind: "reading", sentence: "Are utilities included?", skill: "ask-rent" },
    {
      content: {},
      kind: "listening",
      sentence: "Is the apartment still available?",
      skill: "ask-rent",
    },
    {
      content: {
        language: "en",
        prompt: pt("Fale em voz alta"),
        targetText: "Is the apartment still available?",
        translation: pt("O apartamento ainda está disponível?"),
      },
      kind: "spokenAnswer",
      skill: "ask-rent",
    },
    {
      content: {
        context: pt("O proprietário diz: “The rent is $2,400 a month, utilities not included.”"),
        options: [
          {
            feedback: pt("Isso. “Not included” quer dizer que água, luz e gás são à parte."),
            id: "extra",
            isCorrect: true,
            text: pt("O aluguel é 2.400 dólares e as contas são à parte"),
          },
          {
            feedback: pt("“Not included” quer dizer o contrário: as contas são pagas à parte."),
            id: "included",
            isCorrect: false,
            text: pt("O aluguel já inclui água, luz e gás"),
          },
          {
            feedback: pt("Caução seria deposit. Ele falou do rent, o aluguel mensal."),
            id: "deposit",
            isCorrect: false,
            text: pt("Ele está pedindo 2.400 dólares de caução"),
          },
        ],
        question: pt("O que ele quer dizer?"),
      },
      kind: "multipleChoice",
      skill: "rental-words",
    },
    {
      content: {
        ideas: [
          { text: pt("Rent é o aluguel; landlord é o proprietário.") },
          { text: pt("Deposit é a caução; lease é o contrato.") },
          { text: pt("How much para preço, how many para o que se conta.") },
          { text: pt("“Are utilities included?” pergunta se as contas estão no aluguel.") },
        ],
      },
      kind: "summary",
    },
  ],
  title: pt("Quanto é o aluguel?"),
  words: [
    {
      distractors: ["lease", "deposit"],
      note: pt("Rent também é o verbo alugar: rent an apartment."),
      translation: pt("aluguel"),
      word: "rent",
    },
    {
      distractors: ["tenant"],
      note: pt("Landlord é quem aluga o imóvel para você; tenant é o inquilino."),
      translation: pt("proprietário"),
      word: "landlord",
    },
    {
      distractors: ["rent"],
      note: pt("Deposit também é depósito no banco; no aluguel, é a caução."),
      translation: pt("caução"),
      word: "deposit",
    },
    { distractors: ["rent"], translation: pt("contas de água, luz e gás"), word: "utilities" },
    { distractors: ["rent", "deposit"], translation: pt("contrato de aluguel"), word: "lease" },
  ],
};
