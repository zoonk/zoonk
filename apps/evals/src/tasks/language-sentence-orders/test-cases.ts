import { type TestCase } from "@/lib/types";
import { type LanguageSentenceOrdersParams } from "@zoonk/ai/tasks/language/language-sentence-orders";

export type SentenceOrdersInput = Omit<
  LanguageSentenceOrdersParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "useFallback"
>;

/** `valid` orders a teacher accepts and the task should find; `invalid` ones it must never write. */
type ExpectedOrders = { invalid: string[]; valid: string[] };

export type SentenceOrdersExpected = {
  sentences: { orders: ExpectedOrders; translationOrders: ExpectedOrders }[];
};

export const TEST_CASES: TestCase<SentenceOrdersExpected, SentenceOrdersInput>[] = [
  {
    expectations: `Brazilian Portuguese speaker learning Italian. In the first sentence the subject can follow the verb ("Quando pioveva è arrivato l'autobus") and the "quando" clause can close the sentence; an order that attaches "quando" to the bus's arrival says something else. In the second, "oggi" can close the sentence, but "non" stays right before the verb.`,
    expected: {
      sentences: [
        {
          orders: {
            invalid: ["Quando è arrivato l'autobus pioveva", "Quando l'autobus pioveva è arrivato"],
            valid: ["Quando pioveva è arrivato l'autobus", "L'autobus è arrivato quando pioveva"],
          },
          translationOrders: {
            invalid: ["Quando o ônibus chegou, chovia"],
            valid: ["O ônibus chegou quando chovia"],
          },
        },
        {
          orders: {
            invalid: ["Oggi ho non preso l'ombrello", "Oggi non l'ombrello ho preso"],
            valid: ["Non ho preso l'ombrello oggi"],
          },
          translationOrders: {
            invalid: ["Hoje eu peguei não o guarda-chuva"],
            valid: ["Eu não peguei o guarda-chuva hoje"],
          },
        },
      ],
    },
    id: "pt-it-rain-and-bus",
    userInput: {
      learnerLanguage: "pt",
      sentences: [
        {
          sentence: "Quando pioveva l'autobus è arrivato",
          translation: "Quando chovia, o ônibus chegou",
        },
        {
          sentence: "Oggi non ho preso l'ombrello",
          translation: "Hoje eu não peguei o guarda-chuva",
        },
      ],
      targetLanguage: "it",
    },
  },
  {
    expectations: `US English speaker learning German. Every German order keeps the conjugated verb in second place, so a fronted time phrase is followed by the verb, and the subject-first order is the common alternative. In English a time phrase moves only to the front or the end, never between the verb and its object.`,
    expected: {
      sentences: [
        {
          orders: {
            invalid: [
              "Morgen ich fahre mit dem Zug nach Berlin",
              "Ich morgen fahre mit dem Zug nach Berlin",
            ],
            valid: ["Ich fahre morgen mit dem Zug nach Berlin"],
          },
          translationOrders: {
            invalid: ["I'm taking tomorrow the train to Berlin"],
            valid: ["I'm taking the train to Berlin tomorrow"],
          },
        },
        {
          orders: {
            invalid: ["Am Wochenende ich besuche meine Eltern"],
            valid: ["Ich besuche am Wochenende meine Eltern"],
          },
          translationOrders: {
            invalid: ["I visit on the weekend my parents"],
            valid: ["I visit my parents on the weekend"],
          },
        },
      ],
    },
    id: "en-de-verb-second",
    userInput: {
      learnerLanguage: "en",
      sentences: [
        {
          sentence: "Morgen fahre ich mit dem Zug nach Berlin",
          translation: "Tomorrow I'm taking the train to Berlin",
        },
        {
          sentence: "Am Wochenende besuche ich meine Eltern",
          translation: "On the weekend I visit my parents",
        },
      ],
      targetLanguage: "de",
    },
  },
  {
    expectations: `US English speaker learning Brazilian Portuguese. The "se" and "quando" clauses can come before or after the main clause in both languages, but the words of one clause never move into the other, which would change what depends on what.`,
    expected: {
      sentences: [
        {
          orders: {
            invalid: ["Se eu fico em casa, chover amanhã"],
            valid: ["Eu fico em casa se chover amanhã"],
          },
          translationOrders: {
            invalid: ["If I'll stay home, it rains tomorrow"],
            valid: ["I'll stay home if it rains tomorrow"],
          },
        },
        {
          orders: {
            invalid: ["Quando tomo um banho, chego em casa"],
            valid: ["Tomo um banho quando chego em casa"],
          },
          translationOrders: {
            invalid: ["When I take a shower, I get home"],
            valid: ["I take a shower when I get home"],
          },
        },
      ],
    },
    id: "en-pt-clause-order",
    userInput: {
      learnerLanguage: "en",
      sentences: [
        {
          sentence: "Se chover amanhã, eu fico em casa",
          translation: "If it rains tomorrow, I'll stay home",
        },
        {
          sentence: "Quando chego em casa, tomo um banho",
          translation: "When I get home, I take a shower",
        },
      ],
      targetLanguage: "pt",
    },
  },
  {
    expectations: `US English speaker learning Japanese. Japanese phrases can change places (a time word before or after the topic) as long as the verb stays at the end. In English only "every morning" moves, to the front.`,
    expected: {
      sentences: [
        {
          orders: {
            invalid: ["飲みます私は毎朝コーヒーを"],
            valid: ["毎朝私はコーヒーを飲みます"],
          },
          translationOrders: {
            invalid: ["Coffee I drink every morning", "I every morning drink coffee"],
            valid: ["Every morning I drink coffee"],
          },
        },
      ],
    },
    id: "en-ja-phrase-order",
    userInput: {
      learnerLanguage: "en",
      sentences: [
        { sentence: "私は毎朝コーヒーを飲みます", translation: "I drink coffee every morning" },
      ],
      targetLanguage: "ja",
    },
  },
  {
    expectations: `Japanese speaker learning US English. The Japanese translation's phrases ("土曜日に", "図書館で") can swap as long as the verb stays at the end. In English "on Saturdays" can open the sentence or swap places with "at the library" at the end, while "English" stays right after "study".`,
    expected: {
      sentences: [
        {
          orders: {
            invalid: ["I study at the library English on Saturdays"],
            valid: ["On Saturdays I study English at the library"],
          },
          translationOrders: {
            invalid: ["英語を勉強します土曜日に図書館で"],
            valid: ["図書館で土曜日に英語を勉強します"],
          },
        },
      ],
    },
    id: "ja-en-phrase-tiles",
    userInput: {
      learnerLanguage: "ja",
      sentences: [
        {
          sentence: "I study English at the library on Saturdays",
          translation: "土曜日に図書館で英語を勉強します",
        },
      ],
      targetLanguage: "en",
    },
  },
  {
    expectations: `Brazilian Portuguese speaker learning US English. Who does what to whom is fixed by word order in both sentences: swapping the subject and the object makes a different, wrong sentence. Only the time phrase moves.`,
    expected: {
      sentences: [
        {
          orders: { invalid: ["The boy bit the dog"], valid: [] },
          translationOrders: { invalid: ["O menino mordeu o cachorro"], valid: [] },
        },
        {
          orders: {
            invalid: [
              "My mother calls my sister every Sunday",
              "My sister calls every Sunday my mother",
            ],
            valid: ["Every Sunday my sister calls my mother"],
          },
          translationOrders: {
            invalid: ["Minha mãe liga para minha irmã todo domingo"],
            valid: ["Todo domingo minha irmã liga para minha mãe"],
          },
        },
      ],
    },
    id: "pt-en-rigid-roles",
    userInput: {
      learnerLanguage: "pt",
      sentences: [
        { sentence: "The dog bit the boy", translation: "O cachorro mordeu o menino" },
        {
          sentence: "My sister calls my mother every Sunday",
          translation: "Minha irmã liga para minha mãe todo domingo",
        },
      ],
      targetLanguage: "en",
    },
  },
  {
    expectations: `Brazilian Portuguese speaker learning US English. Moving "only" or "always" changes what it applies to ("Only I drink tea" means nobody else does; "always doesn't" means never), so no order that moves them is listed. Writing no other order is right here.`,
    expected: {
      sentences: [
        {
          orders: { invalid: ["Only I drink tea in the morning"], valid: [] },
          translationOrders: { invalid: ["Só eu bebo chá de manhã"], valid: [] },
        },
        {
          orders: { invalid: ["She always doesn't eat breakfast"], valid: [] },
          translationOrders: { invalid: ["Ela sempre nem toma café da manhã"], valid: [] },
        },
      ],
    },
    id: "pt-en-only-and-negation",
    userInput: {
      learnerLanguage: "pt",
      sentences: [
        { sentence: "I only drink tea in the morning", translation: "Eu só bebo chá de manhã" },
        {
          sentence: "She doesn't always eat breakfast",
          translation: "Ela nem sempre toma café da manhã",
        },
      ],
      targetLanguage: "en",
    },
  },
];
