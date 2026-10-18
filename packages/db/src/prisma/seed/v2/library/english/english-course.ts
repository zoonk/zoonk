import { pt } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedCourse, type SeedItem } from "../types";
import { englishSkills } from "./english-skills";
import { englishUnits } from "./english-units";

const englishItems: SeedItem[] = [
  {
    content: {
      context: pt("Você quer saber o valor da caução do apartamento."),
      options: [
        bankOption(
          pt("How much is the deposit?"),
          pt("Isso. Caução é um preço, então é how much."),
        ),
        bankOption(
          pt("How many is the deposit?"),
          pt("How many é para o que se conta, como quartos. Preço pede how much."),
          pt("Usou how many para preço"),
        ),
        bankOption(
          pt("How much is the rent?"),
          pt("Rent é o aluguel mensal. A caução é deposit."),
          pt("Confundiu rent com deposit"),
        ),
      ],
      question: pt("Qual pergunta você faz?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "ask-deposit-choice",
    skill: "ask-rent",
  },
  {
    content: {
      acceptedAnswers: ["How much is the deposit?"],
      context: null,
      keyPoints: [pt("Usa how much, porque é um preço"), pt("Usa deposit para caução")],
      question: pt("Como você pergunta, em inglês, quanto é a caução?"),
      sampleAnswer: pt("How much is the deposit?"),
    },
    difficulty: -1,
    format: "typed",
    key: "ask-deposit",
    skill: "ask-rent",
  },
  {
    content: {
      acceptedAnswers: ["There are two bathrooms."],
      context: null,
      keyPoints: [pt("Usa there are, porque são dois"), pt("Diz bathrooms no plural")],
      question: pt("Diga em inglês: “Tem dois banheiros.”"),
      sampleAnswer: pt("There are two bathrooms."),
    },
    difficulty: -1,
    format: "spoken",
    key: "two-bathrooms",
    skill: "there-is-are",
  },
  {
    content: {
      context: pt("The landlord asked for first and last month's rent."),
      options: [
        bankOption(
          pt("O primeiro e o último mês de aluguel, pagos adiantado"),
          pt("Isso. Em Toronto é comum pagar o primeiro e o último mês na assinatura do contrato."),
        ),
        bankOption(
          pt("Só o aluguel do primeiro mês"),
          pt("“Last month's rent” é o aluguel do último mês, pago adiantado junto com o primeiro."),
          pt("Ignorou o “last month's rent”"),
        ),
        bankOption(
          pt("A caução e o contrato assinado"),
          pt("Caução seria deposit, e contrato seria lease. A frase fala de dois meses de rent."),
          pt("Confundiu rent com deposit e lease"),
        ),
      ],
      question: pt("O que o proprietário pediu?"),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "first-last-rent",
    skill: "rental-words",
  },
];

/**
 * The language course: English for Portuguese speakers, organized as real situations with "I can"
 * checks. Words and sentences are shared per target language with every other course.
 */
export const englishCourse: SeedCourse = {
  category: "languages",
  chapters: englishUnits,
  description: pt(
    "Inglês para situações reais, do aeroporto ao aluguel, com dicas de pronúncia para quem fala português.",
  ),
  format: "language",
  items: englishItems,
  key: "english",
  languages: ["pt"],
  sentences: [
    { text: "How much is the rent?" },
    { text: "Are utilities included?" },
    { text: "Is the apartment still available?" },
    { text: "There are two bedrooms." },
    { text: "There is a small balcony." },
  ],
  skills: englishSkills,
  slug: pt("ingles-americano-pt"),
  targetLanguage: "en",
  title: pt("Inglês americano"),
  words: [
    {
      pronunciation: pt("rént"),
      text: "rent",
      tip: pt(
        "O r do inglês não vibra: curve a ponta da língua para trás, sem encostar no céu da boca.",
      ),
    },
    {
      pronunciation: pt("LÉND-lórd"),
      text: "landlord",
      tip: pt("O primeiro a soa aberto, quase como o é de “pé”, e o d final quase some."),
    },
    {
      pronunciation: pt("di-PÓ-zit"),
      text: "deposit",
      tip: pt("A força está no PO, e o s soa como z."),
    },
    { pronunciation: pt("líis"), text: "lease", tip: pt("O ea soa como um i comprido: líis.") },
    { pronunciation: pt("iu-TÍ-li-tiz"), text: "utilities" },
    {
      pronunciation: pt("a-VÊI-la-bol"),
      text: "available",
      tip: pt("A sílaba forte é VAI, dita como “vêi”."),
    },
    {
      pronunciation: pt("BÉD-rum"),
      text: "bedroom",
      tip: pt("Bedroom junta bed e room, e o oo soa como u."),
    },
    {
      pronunciation: pt("BÉTH-rum"),
      text: "bathroom",
      tip: pt("No th, ponha a ponta da língua entre os dentes e sopre o ar, sem virar f nem t."),
    },
    { pronunciation: pt("TÉ-nant"), text: "tenant" },
    { pronunciation: pt("KI-tchin"), text: "kitchen" },
  ],
};
