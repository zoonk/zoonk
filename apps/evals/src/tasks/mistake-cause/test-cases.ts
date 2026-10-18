import { type TestCase } from "@/lib/types";
import { type MistakeCauseParams } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type MistakeCauseExpected } from "./scorer";

type MistakeCauseTestCase = TestCase<MistakeCauseExpected, MistakeCauseParams>;

/**
 * Only ambiguous mistakes reach the classifier (code already names time and guesses), so every
 * case has a learner with mixed results on the skill. Labels follow the drill that would help.
 */
function causeCase({
  cause,
  id,
  userInput,
}: MistakeCauseExpected & { id: string; userInput: MistakeCauseParams }): MistakeCauseTestCase {
  return { expected: { cause }, id, userInput };
}

export const TEST_CASES: MistakeCauseTestCase[] = [
  causeCase({
    cause: "trap",
    id: "en-trap-raise-then-discount",
    userInput: {
      correctAnswer: "$99",
      language: "en",
      learnerAnswer: "$100",
      misconception: "Assumes a 10% raise followed by a 10% discount cancel out",
      question: "A $100 jacket goes up 10%, then goes on sale for 10% off. What does it cost now?",
      recentAccuracy: "4 of 5 right",
    },
  }),
  causeCase({
    cause: "gap",
    id: "en-gap-percent-of-wrong-base",
    userInput: {
      correctAnswer: "25%",
      language: "en",
      learnerAnswer: "20%",
      misconception: "Computes the change relative to the new value instead of the original",
      question: "A price goes from $80 to $100. By what percentage did it increase?",
      recentAccuracy: "2 of 5 right",
    },
  }),
  causeCase({
    cause: "misread",
    id: "en-misread-not-question",
    userInput: {
      correctAnswer: "Mercury",
      language: "en",
      learnerAnswer: "Mars",
      misconception: "",
      question: "Which of these planets does NOT have a moon? Mars, Mercury, Earth, Jupiter",
      recentAccuracy: "4 of 5 right",
    },
  }),
  causeCase({
    cause: "gap",
    id: "en-gap-photosynthesis-inputs",
    userInput: {
      correctAnswer: "Carbon dioxide and water",
      language: "en",
      learnerAnswer: "Oxygen and glucose",
      misconception: "Confuses the inputs of photosynthesis with its outputs",
      question: "What does a plant take in to make its food through photosynthesis?",
      recentAccuracy: "2 of 4 right",
    },
  }),
  causeCase({
    cause: "misread",
    id: "en-misread-units",
    userInput: {
      correctAnswer: "1.5 hours",
      language: "en",
      learnerAnswer: "90 hours",
      misconception: "",
      question: "A 90-minute movie starts at 7 pm. How long is the movie, in hours?",
      recentAccuracy: "5 of 6 right",
    },
  }),
  causeCase({
    cause: "trap",
    id: "en-trap-partial-step",
    userInput: {
      correctAnswer: "x = 4",
      language: "en",
      learnerAnswer: "2x = 8",
      misconception: "Stops at an intermediate step and takes it as the final answer",
      question: "Solve for x: 2x + 3 = 11",
      recentAccuracy: "4 of 5 right",
    },
  }),
  causeCase({
    cause: "gap",
    id: "en-gap-affect-effect",
    userInput: {
      correctAnswer: "affect",
      language: "en",
      learnerAnswer: "effect",
      misconception: "Uses the noun where the verb is needed",
      question: "Choose the word that fits: 'Lack of sleep can ___ your memory.'",
      recentAccuracy: "1 of 3 right",
    },
  }),
  causeCase({
    cause: "trap",
    id: "en-trap-median-vs-mean",
    userInput: {
      correctAnswer: "4",
      language: "en",
      learnerAnswer: "5",
      misconception: "Gives the mean when the question asks for the median",
      question: "What is the median of 1, 3, 4, 7, 10?",
      recentAccuracy: "3 of 4 right",
    },
  }),
  causeCase({
    cause: "trap",
    id: "pt-trap-desconto-sobre-desconto",
    userInput: {
      correctAnswer: "R$ 72",
      language: "pt",
      learnerAnswer: "R$ 70",
      misconception: "Soma os descontos sucessivos em vez de aplicá-los um sobre o outro",
      question:
        "Uma camiseta de R$ 100 tem 20% de desconto e, no caixa, mais 10% sobre o novo preço. Quanto ela custa?",
      recentAccuracy: "4 de 5 certas",
    },
  }),
  causeCase({
    cause: "gap",
    id: "pt-gap-regra-de-tres-inversa",
    userInput: {
      correctAnswer: "3 dias",
      language: "pt",
      learnerAnswer: "12 dias",
      misconception: "Usa proporção direta quando as grandezas são inversamente proporcionais",
      question:
        "4 pedreiros constroem um muro em 6 dias. Em quantos dias 8 pedreiros constroem o mesmo muro?",
      recentAccuracy: "2 de 5 certas",
    },
  }),
  causeCase({
    cause: "misread",
    id: "pt-misread-exceto",
    userInput: {
      correctAnswer: "Fotossíntese",
      language: "pt",
      learnerAnswer: "Respiração celular",
      misconception: "",
      question:
        "Todos os processos abaixo liberam energia para a célula, EXCETO: respiração celular, fermentação, fotossíntese, glicólise.",
      recentAccuracy: "5 de 6 certas",
    },
  }),
  causeCase({
    cause: "gap",
    id: "pt-gap-crase",
    userInput: {
      correctAnswer: "Vou à escola",
      language: "pt",
      learnerAnswer: "Vou a escola",
      misconception: "Não reconhece a fusão da preposição com o artigo feminino",
      question: "Qual frase está correta quanto ao uso da crase?",
      recentAccuracy: "1 de 3 certas",
    },
  }),
  causeCase({
    cause: "trap",
    id: "pt-trap-porcentagem-de-porcentagem",
    userInput: {
      correctAnswer: "Aumentou 21%",
      language: "pt",
      learnerAnswer: "Aumentou 20%",
      misconception: "Soma dois aumentos sucessivos de 10% como se fossem 20%",
      question:
        "Um preço aumentou 10% em janeiro e mais 10% em fevereiro. Qual foi o aumento total?",
      recentAccuracy: "3 de 4 certas",
    },
  }),
  causeCase({
    cause: "misread",
    id: "pt-misread-unidade-pedida",
    userInput: {
      correctAnswer: "2,5 km",
      language: "pt",
      learnerAnswer: "2.500 km",
      misconception: "",
      question: "Ana caminhou 2.500 metros. Quantos quilômetros ela caminhou?",
      recentAccuracy: "4 de 5 certas",
    },
  }),
  causeCase({
    cause: "gap",
    id: "pt-gap-mitose-meiose",
    userInput: {
      correctAnswer: "Meiose",
      language: "pt",
      learnerAnswer: "Mitose",
      misconception: "Confunde a divisão que forma gametas com a que forma células iguais",
      question: "Qual divisão celular forma os gametas, com metade dos cromossomos?",
      recentAccuracy: "2 de 4 certas",
    },
  }),
  causeCase({
    cause: "misread",
    id: "en-misread-least-likely",
    userInput: {
      correctAnswer: "Rolling a 7 with one die",
      language: "en",
      learnerAnswer: "Flipping heads with a coin",
      misconception: "",
      question:
        "Which event is LEAST likely? Flipping heads with a coin, rolling an even number with one die, rolling a 7 with one die.",
      recentAccuracy: "5 of 6 right",
    },
  }),
];
