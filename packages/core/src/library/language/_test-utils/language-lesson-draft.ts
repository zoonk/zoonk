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

/**
 * An English lesson for a learner who reads the app in English (an IELTS candidate), as the writer
 * returns it: words have definitions, and sentences come back as they are.
 */
export function sameLanguageLessonDraft(
  overrides: Partial<LanguageLessonContent> = {},
): LanguageLessonContent {
  return languageLessonDraft({
    practice: [
      {
        answer: "need",
        distractors: ["needs", "needing"],
        feedback: "Use 'need' after a plural subject like 'plants'.",
        question: null,
        template: "Plants [BLANK] water to grow",
      },
    ],
    sentences: [
      {
        distractors: ["needs", "feed"],
        explanation: "The subject 'plants' is plural, so the verb has no -s.",
        romanization: null,
        sentence: "Plants need water to grow",
        speakingPrompt: "Read the fact about plants aloud.",
        translation: "Plants need water to grow",
        translationDistractors: ["needs", "feed"],
      },
      {
        distractors: ["does", "needs"],
        explanation: "A yes-or-no question starts with 'do' before a plural subject.",
        romanization: null,
        sentence: "Do plants need light?",
        speakingPrompt: null,
        translation: "Do plants need light?",
        translationDistractors: ["does", "needs"],
      },
      {
        distractors: ["grows", "glow"],
        explanation: "'Grow' takes no -s after 'plants'.",
        romanization: null,
        sentence: "Plants grow in many places",
        speakingPrompt: null,
        translation: "Plants grow in many places",
        translationDistractors: ["grows", "glow"],
      },
    ],
    summary: [
      "'Plants need water' states what plants require.",
      "'Do plants grow?' asks a question.",
    ],
    tip: {
      examples: [
        { sentence: "Plants need water", translation: "Plants need water" },
        { sentence: "Do plants need light?", translation: "Do plants need light?" },
      ],
      text: "After a plural subject like `plants`, the verb has no -s.",
      title: "Verbs after plural subjects",
    },
    words: [
      {
        distractors: ["feed", "read", "have"],
        note: null,
        pronunciation: "NEED",
        romanization: null,
        tip: null,
        translation: "need",
        word: "need",
      },
      {
        distractors: ["weather", "air", "soil"],
        note: null,
        pronunciation: "WAW-ter",
        romanization: null,
        tip: null,
        translation: "the clear liquid that falls as rain",
        word: "water",
      },
      {
        distractors: ["go", "glow", "shrink"],
        note: null,
        pronunciation: "GROH",
        romanization: null,
        tip: null,
        translation: "to get bigger over time",
        word: "grow",
      },
    ],
    writing: {
      answers: ["Plants need light to grow."],
      keyPoints: ["Uses 'need' after 'plants'"],
      prompt: "Write one sentence saying that plants require light so they can get bigger.",
    },
    ...overrides,
  });
}
