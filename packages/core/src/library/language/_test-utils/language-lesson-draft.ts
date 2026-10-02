import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";

/**
 * A complete English lesson for Brazilian Portuguese speakers, as the writer
 * returns it, for tests of what code does with a draft.
 */
export function languageLessonDraft(
  overrides: Partial<LanguageLessonContent> = {},
): LanguageLessonContent {
  return {
    practice: [
      {
        answer: "is",
        distractors: ["are", "be"],
        feedback: "'Rent' é singular, então usamos 'is'.",
        question: "Complete a pergunta.",
        template: "How much [BLANK] the rent?",
      },
    ],
    sentences: [
      {
        distractors: ["are", "many"],
        explanation: "Em inglês, 'how much' vem antes do verbo, como 'quanto' em português.",
        romanization: null,
        sentence: "How much is the rent?",
        speakingPrompt: "Pergunte quanto é o aluguel.",
        translation: "Quanto é o aluguel?",
        translationDistractors: ["renda", "custa"],
      },
      {
        distractors: ["pay", "cost"],
        explanation: "'Deposit' é o valor que você deixa como garantia.",
        romanization: null,
        sentence: "Is there a deposit?",
        speakingPrompt: null,
        translation: "Tem caução?",
        translationDistractors: ["aluguel", "conta"],
      },
      {
        distractors: ["is", "includes"],
        explanation: "'Utilities' são as contas da casa, como luz e água.",
        romanization: null,
        sentence: "Utilities are included",
        speakingPrompt: "Diga que as contas estão incluídas.",
        translation: "As contas estão incluídas",
        translationDistractors: ["aluguel", "não"],
      },
    ],
    summary: ["'How much is the rent?' pergunta o valor do aluguel.", "'Deposit' é a caução."],
    tip: {
      examples: [
        { sentence: "How much is the rent?", translation: "Quanto é o aluguel?" },
        { sentence: "How much are the utilities?", translation: "Quanto são as contas?" },
      ],
      text: "Use `how much is` para uma coisa e `how much are` para várias.",
      title: "Perguntar preços com how much",
    },
    words: [
      {
        distractors: ["income", "salary", "the rent"],
        note: "Em português, 'renda' é o que você ganha; 'rent' é o aluguel.",
        pronunciation: "RÉNT",
        romanization: null,
        tip: "O 'r' do inglês não é o 'r' de 'rato': curve a língua para trás sem encostar no céu da boca.",
        translation: "o aluguel",
        word: "the rent",
      },
      {
        distractors: ["the receipt", "the fee", "the bill"],
        note: null,
        pronunciation: "di-PÓ-zit",
        romanization: null,
        tip: null,
        translation: "a caução",
        word: "the deposit",
      },
      {
        distractors: ["the bills", "the services", "the taxes"],
        note: null,
        pronunciation: "iu-TI-li-tiz",
        romanization: null,
        tip: null,
        translation: "as contas da casa",
        word: "the utilities",
      },
    ],
    writing: {
      answers: ["How much is the rent?", "What's the rent?"],
      keyPoints: ["Usa 'how much is' para perguntar o valor"],
      prompt: "Escreva em inglês: Quanto é o aluguel?",
    },
    ...overrides,
  };
}
