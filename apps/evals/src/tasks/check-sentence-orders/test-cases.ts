import { type TestCase } from "@/lib/types";
import { type CheckSentenceOrdersParams } from "@zoonk/ai/tasks/language/check-sentence-orders";

export type CheckSentenceOrdersInput = Pick<
  CheckSentenceOrdersParams,
  "learnerLanguage" | "sentences" | "targetLanguage"
>;

/**
 * `valid` orders a native teacher accepts, `invalid` ones a learner must never be marked right for,
 * and `unscored` ones the labelers didn't agree on, which the reviewer reads but nothing scores.
 */
export type LabeledOrders = { invalid?: string[]; unscored?: string[]; valid?: string[] };

type LabeledSentence = {
  sentence: string;
  translation: string;
  orders: LabeledOrders;
  translationOrders: LabeledOrders;
};

export type CheckSentenceOrdersExpected = {
  sentences: Pick<LabeledSentence, "orders" | "translationOrders">[];
};

/** The reviewer reads the labeled orders mixed together, in a fixed order that doesn't group them by label. */
function toCandidates({ invalid = [], unscored = [], valid = [] }: LabeledOrders): string[] {
  return [...valid, ...invalid, ...unscored].toSorted((first, second) =>
    first.localeCompare(second, "en"),
  );
}

function labeledCase({
  id,
  learnerLanguage,
  origin,
  sentences,
  targetLanguage,
}: {
  id: string;
  learnerLanguage: string;
  origin?: "production";
  sentences: LabeledSentence[];
  targetLanguage: string;
}): TestCase<CheckSentenceOrdersExpected, CheckSentenceOrdersInput> {
  return {
    expected: {
      sentences: sentences.map(({ orders, translationOrders }) => ({ orders, translationOrders })),
    },
    id,
    origin,
    userInput: {
      learnerLanguage,
      sentences: sentences.map((item) => ({
        sentence: item.sentence,
        sentenceCandidates: toCandidates(item.orders),
        translation: item.translation,
        translationCandidates: toCandidates(item.translationOrders),
      })),
      targetLanguage,
    },
  };
}

/**
 * Each case is a lesson's sentences with the candidates the writer models proposed for them in the
 * `language-sentence-orders` eval, or, for production cases, the orders a shared lesson saved.
 */
export const TEST_CASES: TestCase<CheckSentenceOrdersExpected, CheckSentenceOrdersInput>[] = [
  labeledCase({
    id: "pt-it-rain-and-bus",
    learnerLanguage: "pt",
    sentences: [
      {
        orders: {
          invalid: [
            "Pioveva quando è arrivato l'autobus",
            "Pioveva quando l'autobus è arrivato",
            "Quando è arrivato l'autobus pioveva",
            "Quando l'autobus è arrivato pioveva",
            "Quando l'autobus pioveva è arrivato",
          ],
          unscored: ["L'autobus quando pioveva è arrivato"],
          valid: [
            "È arrivato l'autobus quando pioveva",
            "L'autobus è arrivato quando pioveva",
            "Quando pioveva è arrivato l'autobus",
          ],
        },
        sentence: "Quando pioveva l'autobus è arrivato",
        translation: "Quando chovia, o ônibus chegou",
        translationOrders: {
          invalid: [
            "Chovia quando chegou o ônibus",
            "Chovia quando o ônibus chegou",
            "O ônibus, quando chovia, chegou",
            "Quando chegou o ônibus, chovia",
            "Quando o ônibus chegou, chovia",
          ],
          valid: [
            "Chegou o ônibus quando chovia",
            "O ônibus chegou quando chovia",
            "Quando chovia, chegou o ônibus",
          ],
        },
      },
      {
        orders: {
          invalid: [
            "L'ombrello non ho preso oggi",
            "L'ombrello oggi non ho preso",
            "Oggi ho non preso l'ombrello",
            "Oggi l'ombrello non ho preso",
            "Oggi non l'ombrello ho preso",
          ],
          valid: ["Non ho preso l'ombrello oggi", "Non ho preso oggi l'ombrello"],
        },
        sentence: "Oggi non ho preso l'ombrello",
        translation: "Hoje eu não peguei o guarda-chuva",
        translationOrders: {
          invalid: [
            "Eu hoje o guarda-chuva não peguei",
            "Eu o guarda-chuva não peguei hoje",
            "Hoje eu peguei não o guarda-chuva",
            "Não peguei o guarda-chuva hoje, eu",
            "O guarda-chuva eu hoje não peguei",
          ],
          unscored: [
            "Hoje o guarda-chuva eu não peguei",
            "O guarda-chuva eu não peguei hoje",
            "O guarda-chuva hoje eu não peguei",
          ],
          valid: [
            "Eu hoje não peguei o guarda-chuva",
            "Eu não peguei hoje o guarda-chuva",
            "Eu não peguei o guarda-chuva hoje",
          ],
        },
      },
      {
        orders: {
          invalid: ["In ritardo l'autobus è arrivato", "L'autobus in ritardo è arrivato"],
          unscored: ["In ritardo è arrivato l'autobus"],
          valid: ["È arrivato in ritardo l'autobus", "È arrivato l'autobus in ritardo"],
        },
        sentence: "L'autobus è arrivato in ritardo",
        translation: "O ônibus chegou atrasado",
        translationOrders: {
          invalid: [
            "Atrasado chegou o ônibus",
            "Atrasado, o ônibus chegou",
            "O ônibus atrasado chegou",
          ],
          unscored: ["Chegou o ônibus atrasado"],
          valid: ["Chegou atrasado o ônibus"],
        },
      },
    ],
    targetLanguage: "it",
  }),
  labeledCase({
    id: "en-de-verb-second",
    learnerLanguage: "en",
    sentences: [
      {
        orders: {
          invalid: [
            "Ich fahre mit dem Zug nach Berlin morgen",
            "Ich fahre nach Berlin mit dem Zug morgen",
            "Ich fahre nach Berlin morgen mit dem Zug",
            "Ich morgen fahre mit dem Zug nach Berlin",
            "Mit dem Zug fahre ich nach Berlin morgen",
            "Morgen ich fahre mit dem Zug nach Berlin",
            "Nach Berlin fahre ich mit dem Zug morgen",
          ],
          unscored: ["Ich fahre mit dem Zug morgen nach Berlin"],
          valid: [
            "Ich fahre morgen mit dem Zug nach Berlin",
            "Ich fahre morgen nach Berlin mit dem Zug",
            "Mit dem Zug fahre ich morgen nach Berlin",
            "Morgen fahre ich nach Berlin mit dem Zug",
            "Nach Berlin fahre ich morgen mit dem Zug",
          ],
        },
        sentence: "Morgen fahre ich mit dem Zug nach Berlin",
        translation: "Tomorrow I'm taking the train to Berlin",
        translationOrders: {
          invalid: [
            "I'm taking tomorrow the train to Berlin",
            "To Berlin I'm taking the train tomorrow",
            "To Berlin tomorrow I'm taking the train",
            "Tomorrow to Berlin I'm taking the train",
          ],
          unscored: ["I'm taking the train tomorrow to Berlin"],
          valid: ["I'm taking the train to Berlin tomorrow"],
        },
      },
      {
        orders: {
          invalid: [
            "Am Wochenende besuche meine Eltern ich",
            "Am Wochenende ich besuche meine Eltern",
            "Meine Eltern besuche am Wochenende ich",
          ],
          valid: [
            "Ich besuche am Wochenende meine Eltern",
            "Ich besuche meine Eltern am Wochenende",
            "Meine Eltern besuche ich am Wochenende",
          ],
        },
        sentence: "Am Wochenende besuche ich meine Eltern",
        translation: "On the weekend I visit my parents",
        translationOrders: {
          invalid: ["I visit on the weekend my parents", "My parents I visit on the weekend"],
          valid: ["I visit my parents on the weekend"],
        },
      },
    ],
    targetLanguage: "de",
  }),
  labeledCase({
    id: "en-pt-clause-order",
    learnerLanguage: "en",
    sentences: [
      {
        orders: {
          invalid: [
            "Em casa eu fico se chover amanhã",
            "Em casa, se chover amanhã, eu fico",
            "Se chover amanhã, em casa eu fico",
            "Se eu fico em casa, chover amanhã",
          ],
          unscored: [
            "Amanhã eu fico em casa se chover",
            "Amanhã, se chover, eu fico em casa",
            "Eu fico em casa amanhã se chover",
            "Eu, se amanhã chover, fico em casa",
            "Eu, se chover amanhã, fico em casa",
            "Se chover, eu fico em casa amanhã",
          ],
          valid: [
            "Eu fico em casa se amanhã chover",
            "Eu fico em casa se chover amanhã",
            "Se amanhã chover, eu fico em casa",
          ],
        },
        sentence: "Se chover amanhã, eu fico em casa",
        translation: "If it rains tomorrow, I'll stay home",
        translationOrders: {
          invalid: [
            "I'll, if it rains tomorrow, stay home",
            "If I'll stay home, it rains tomorrow",
            "If tomorrow it rains, I'll stay home",
          ],
          unscored: [
            "I'll stay home tomorrow if it rains",
            "If it rains, I'll stay home tomorrow",
            "Tomorrow I'll stay home if it rains",
            "Tomorrow, if it rains, I'll stay home",
          ],
          valid: ["I'll stay home if it rains tomorrow"],
        },
      },
      {
        orders: {
          invalid: [
            "Em casa tomo um banho quando chego",
            "Em casa, quando chego, tomo um banho",
            "Quando tomo um banho, chego em casa",
            "Tomo, quando chego em casa, um banho",
            "Um banho tomo quando chego em casa",
          ],
          valid: ["Tomo um banho quando chego em casa"],
        },
        sentence: "Quando chego em casa, tomo um banho",
        translation: "When I get home, I take a shower",
        translationOrders: {
          invalid: [
            "A shower I take when I get home",
            "I, when I get home, take a shower",
            "When I take a shower, I get home",
          ],
          valid: ["I take a shower when I get home"],
        },
      },
    ],
    targetLanguage: "pt",
  }),
  labeledCase({
    id: "en-ja-phrase-order",
    learnerLanguage: "en",
    sentences: [
      {
        orders: {
          invalid: [
            "コーヒーを毎朝飲みます私は",
            "コーヒーを私は飲みます毎朝",
            "コーヒーを飲みます私は毎朝",
            "毎朝コーヒーを飲みます私は",
            "毎朝私は飲みますコーヒーを",
            "毎朝飲みます私はコーヒーを",
            "私はコーヒーを飲みます毎朝",
            "私は毎朝飲みますコーヒーを",
            "私は飲みますコーヒーを毎朝",
            "私は飲みます毎朝コーヒーを",
            "飲みます私は毎朝コーヒーを",
          ],
          unscored: [
            "コーヒーを毎朝私は飲みます",
            "コーヒーを私は毎朝飲みます",
            "毎朝コーヒーを私は飲みます",
          ],
          valid: ["毎朝私はコーヒーを飲みます", "私はコーヒーを毎朝飲みます"],
        },
        sentence: "私は毎朝コーヒーを飲みます",
        translation: "I drink coffee every morning",
        translationOrders: {
          invalid: ["Coffee I drink every morning", "I every morning drink coffee"],
          valid: ["Every morning I drink coffee"],
        },
      },
    ],
    targetLanguage: "ja",
  }),
  labeledCase({
    id: "ja-en-phrase-tiles",
    learnerLanguage: "ja",
    sentences: [
      {
        orders: {
          invalid: [
            "I on Saturdays study English at the library",
            "I study at the library English on Saturdays",
          ],
          unscored: [
            "At the library on Saturdays I study English",
            "On Saturdays at the library I study English",
          ],
          valid: [
            "At the library I study English on Saturdays",
            "I study English on Saturdays at the library",
            "On Saturdays I study English at the library",
          ],
        },
        sentence: "I study English at the library on Saturdays",
        translation: "土曜日に図書館で英語を勉強します",
        translationOrders: {
          invalid: [
            "図書館で勉強します、土曜日に英語を",
            "図書館で土曜日に勉強します、英語を",
            "図書館で英語を勉強します、土曜日に",
            "土曜日に勉強します、図書館で英語を",
            "土曜日に図書館で勉強します、英語を",
            "土曜日に英語を勉強します、図書館で",
            "英語を勉強します、図書館で土曜日に",
            "英語を勉強します、土曜日に図書館で",
          ],
          unscored: [
            "図書館で英語を土曜日に勉強します",
            "英語を図書館で土曜日に勉強します",
            "英語を土曜日に図書館で勉強します",
          ],
          valid: ["図書館で土曜日に英語を勉強します", "土曜日に英語を図書館で勉強します"],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-en-rigid-roles",
    learnerLanguage: "pt",
    sentences: [
      {
        orders: { invalid: ["The boy bit the dog", "The boy, the dog bit"] },
        sentence: "The dog bit the boy",
        translation: "O cachorro mordeu o menino",
        translationOrders: {
          invalid: ["O menino mordeu o cachorro", "O menino, o cachorro mordeu"],
        },
      },
      {
        orders: {
          invalid: [
            "Every Sunday, my mother, my sister calls",
            "My mother calls my sister every Sunday",
            "My mother, every Sunday, my sister calls",
            "My mother, my sister calls every Sunday",
            "My sister calls every Sunday my mother",
          ],
          unscored: ["My sister, every Sunday, calls my mother"],
          valid: ["Every Sunday my sister calls my mother"],
        },
        sentence: "My sister calls my mother every Sunday",
        translation: "Minha irmã liga para minha mãe todo domingo",
        translationOrders: {
          invalid: [
            "Liga para minha mãe todo domingo, minha irmã",
            "Liga todo domingo para minha mãe, minha irmã",
            "Minha mãe liga para minha irmã todo domingo",
            "Para minha mãe minha irmã liga todo domingo",
            "Para minha mãe, todo domingo, minha irmã liga",
            "Todo domingo liga para minha mãe, minha irmã",
            "Todo domingo, para minha mãe, minha irmã liga",
          ],
          valid: [
            "Minha irmã liga todo domingo para minha mãe",
            "Minha irmã todo domingo liga para minha mãe",
            "Todo domingo minha irmã liga para minha mãe",
          ],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-en-only-and-negation",
    learnerLanguage: "pt",
    sentences: [
      {
        orders: {
          invalid: [
            "I drink only tea in the morning",
            "I in the morning only drink tea",
            "I only in the morning drink tea",
            "In the morning I drink only tea",
            "In the morning, I only drink tea",
            "I drink tea in the morning only",
            "I drink tea only in the morning",
            "Only I drink tea in the morning",
            "Tea I drink in the morning only",
            "Tea I drink only in the morning",
            "Tea I only drink in the morning",
          ],
        },
        sentence: "I only drink tea in the morning",
        translation: "Eu só bebo chá de manhã",
        translationOrders: {
          invalid: [
            "Chá eu bebo de manhã só",
            "Chá eu bebo só de manhã",
            "Chá eu só bebo de manhã",
            "De manhã eu bebo só chá",
            "De manhã eu só bebo chá",
            "Eu bebo chá de manhã só",
            "Eu bebo chá só de manhã",
            "Eu bebo de manhã só chá",
            "Eu bebo só chá de manhã",
            "Eu de manhã bebo só chá",
            "Eu de manhã só bebo chá",
            "Eu só de manhã bebo chá",
            "Só chá eu bebo de manhã",
            "Só de manhã eu bebo chá",
            "Só eu bebo chá de manhã",
          ],
        },
      },
      {
        orders: {
          invalid: [
            "Breakfast she doesn't always eat",
            "She always doesn't eat breakfast",
            "She doesn't eat breakfast always",
          ],
        },
        sentence: "She doesn't always eat breakfast",
        translation: "Ela nem sempre toma café da manhã",
        translationOrders: {
          invalid: [
            "Café da manhã nem sempre ela toma",
            "Ela sempre nem toma café da manhã",
            "Ela toma café da manhã, nem sempre",
          ],
          unscored: ["Café da manhã ela nem sempre toma"],
          valid: ["Nem sempre ela toma café da manhã"],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-en-renting-questions",
    learnerLanguage: "pt",
    sentences: [
      {
        orders: { invalid: ["How much the rent is?", "The rent is how much?"] },
        sentence: "How much is the rent?",
        translation: "Quanto é o aluguel?",
        translationOrders: {
          invalid: ["Quanto o aluguel é?"],
          valid: ["É quanto o aluguel?", "O aluguel é quanto?", "O aluguel, quanto é?"],
        },
      },
      {
        orders: {
          invalid: [
            "In the rent, utilities are included?",
            "Included in the rent are utilities?",
            "Utilities are included in the rent?",
          ],
          unscored: ["In the rent, are utilities included?"],
        },
        sentence: "Are utilities included in the rent?",
        translation: "As contas de serviços estão incluídas no aluguel?",
        translationOrders: {
          invalid: [
            "As contas de serviços, no aluguel, estão incluídas?",
            "Estão as contas de serviços incluídas no aluguel?",
          ],
          unscored: ["No aluguel as contas de serviços estão incluídas?"],
          valid: [
            "Estão incluídas as contas de serviços no aluguel?",
            "Estão incluídas no aluguel as contas de serviços?",
            "No aluguel estão incluídas as contas de serviços?",
          ],
        },
      },
      {
        orders: { invalid: ["In the rent, water is included", "Included in the rent is water"] },
        sentence: "Water is included in the rent",
        translation: "A água está incluída no aluguel",
        translationOrders: {
          invalid: [
            "A água, no aluguel, está incluída",
            "Está a água incluída no aluguel",
            "Incluída no aluguel está a água",
          ],
          unscored: ["Está incluída a água no aluguel", "No aluguel, a água está incluída"],
          valid: ["Está incluída no aluguel a água", "No aluguel está incluída a água"],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-it-yesterday-production",
    learnerLanguage: "pt",
    origin: "production",
    sentences: [
      {
        orders: {
          invalid: [
            "Ho mangiato ieri una pizza io",
            "Ho mangiato io ieri una pizza",
            "Ho mangiato io una pizza ieri",
            "Ho mangiato una pizza ieri io",
            "Ho mangiato una pizza io ieri",
            "Ieri ho mangiato io una pizza",
            "Ieri ho mangiato una pizza io",
          ],
          valid: [
            "Ieri io ho mangiato una pizza",
            "Io ho mangiato ieri una pizza",
            "Io ieri ho mangiato una pizza",
          ],
        },
        sentence: "Io ho mangiato una pizza ieri",
        translation: "Eu comi uma pizza ontem",
        translationOrders: {
          invalid: ["Ontem uma pizza eu comi", "Uma pizza ontem eu comi"],
          unscored: ["Uma pizza eu comi ontem"],
          valid: ["Eu comi ontem uma pizza", "Eu ontem comi uma pizza", "Ontem eu comi uma pizza"],
        },
      },
      {
        orders: { valid: ["Hai comprato ieri il pane?", "Ieri hai comprato il pane?"] },
        sentence: "Hai comprato il pane ieri?",
        translation: "Você comprou o pão ontem?",
        translationOrders: {
          invalid: ["O pão ontem você comprou?", "Ontem o pão você comprou?"],
          unscored: ["O pão você comprou ontem?"],
          valid: [
            "Ontem você comprou o pão?",
            "Você comprou ontem o pão?",
            "Você ontem comprou o pão?",
          ],
        },
      },
      {
        orders: { valid: ["Ho visto ieri un film", "Ho visto un film ieri"] },
        sentence: "Ieri ho visto un film",
        translation: "Ontem eu vi um filme",
        translationOrders: {
          invalid: ["Ontem um filme eu vi", "Um filme ontem eu vi"],
          unscored: ["Um filme eu vi ontem"],
          valid: ["Eu ontem vi um filme", "Eu vi ontem um filme", "Eu vi um filme ontem"],
        },
      },
      {
        orders: { valid: ["Ho fatto ieri una passeggiata", "Ieri ho fatto una passeggiata"] },
        sentence: "Ho fatto una passeggiata ieri",
        translation: "Eu fiz uma caminhada ontem",
        translationOrders: {
          invalid: ["Ontem uma caminhada eu fiz", "Uma caminhada ontem eu fiz"],
          unscored: ["Uma caminhada eu fiz ontem"],
          valid: [
            "Eu fiz ontem uma caminhada",
            "Eu ontem fiz uma caminhada",
            "Ontem eu fiz uma caminhada",
          ],
        },
      },
    ],
    targetLanguage: "it",
  }),
  labeledCase({
    id: "pt-en-birthday-production",
    learnerLanguage: "pt",
    origin: "production",
    sentences: [
      {
        orders: { invalid: ["Your birthday is when?"] },
        sentence: "When is your birthday?",
        translation: "Quando é seu aniversário?",
        translationOrders: { valid: ["É quando seu aniversário?", "Seu aniversário é quando?"] },
      },
      {
        orders: { valid: ["June fifth is my birthday"] },
        sentence: "My birthday is June fifth",
        translation: "Meu aniversário é cinco de junho",
        translationOrders: { valid: ["Cinco de junho é meu aniversário"] },
      },
      {
        orders: { invalid: ["Your birthday is in June?"] },
        sentence: "Is your birthday in June?",
        translation: "Seu aniversário é em junho?",
        translationOrders: {
          invalid: ["Em junho é seu aniversário?"],
          valid: ["É em junho seu aniversário?"],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-en-write-it-down-production",
    learnerLanguage: "pt",
    origin: "production",
    sentences: [
      {
        orders: { invalid: ["You can write it down?"] },
        sentence: "Can you write it down?",
        translation: "Você pode anotar isso?",
        translationOrders: { unscored: ["Isso você pode anotar?"] },
      },
      {
        orders: { invalid: ["You can give me an example?"] },
        sentence: "Can you give me an example?",
        translation: "Você pode me dar um exemplo?",
        translationOrders: { invalid: ["Um exemplo, você pode me dar?"] },
      },
      {
        orders: { invalid: ["That word I still don't understand"] },
        sentence: "I still don't understand that word",
        translation: "Eu ainda não entendo essa palavra",
        translationOrders: {
          valid: [
            "Essa palavra eu ainda não entendo",
            "Essa palavra eu não entendo ainda",
            "Eu não entendo ainda essa palavra",
            "Eu não entendo essa palavra ainda",
          ],
        },
      },
      {
        orders: { invalid: ["You can say it another way?"] },
        sentence: "Can you say it another way?",
        translation: "Você pode dizer isso de outra maneira?",
        translationOrders: {
          invalid: ["De outra maneira, você pode dizer isso?"],
          unscored: ["Isso você pode dizer de outra maneira?"],
        },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "pt-en-faucet-production",
    learnerLanguage: "pt",
    origin: "production",
    sentences: [
      {
        orders: { valid: ["The faucet only drips when I turn it on"] },
        sentence: "The faucet drips only when I turn it on",
        translation: "A torneira goteja só quando eu a abro",
        translationOrders: {
          unscored: ["Só quando eu a abro a torneira goteja"],
          valid: ["A torneira só goteja quando eu a abro"],
        },
      },
      {
        orders: { valid: ["When it gets too hot, the heater shuts off"] },
        sentence: "The heater shuts off when it gets too hot",
        translation: "O aquecedor desliga quando fica quente demais",
        translationOrders: {
          invalid: ["Quando o aquecedor fica quente demais, desliga"],
          valid: ["Quando fica quente demais, o aquecedor desliga"],
        },
      },
      {
        orders: { valid: ["When you turn it on, does the faucet drip?"] },
        sentence: "Does the faucet drip when you turn it on?",
        translation: "A torneira goteja quando você a abre?",
        translationOrders: { valid: ["Quando você a abre, a torneira goteja?"] },
      },
      {
        orders: { valid: ["After I turn it on, it shuts off"] },
        sentence: "It shuts off after I turn it on",
        translation: "Ele desliga depois que eu o ligo",
        translationOrders: { valid: ["Depois que eu o ligo, ele desliga"] },
      },
    ],
    targetLanguage: "en",
  }),
  labeledCase({
    id: "en-es-where-from-production",
    learnerLanguage: "en",
    origin: "production",
    sentences: [
      {
        orders: { valid: ["¿De México eres tú?", "¿Eres de México tú?", "¿Eres tú de México?"] },
        sentence: "¿Tú eres de México?",
        translation: "Are you from Mexico?",
        translationOrders: { invalid: ["You are from Mexico?"] },
      },
      {
        orders: {
          valid: [
            "¿De Guadalajara es usted?",
            "¿Es de Guadalajara usted?",
            "¿Es usted de Guadalajara?",
          ],
        },
        sentence: "¿Usted es de Guadalajara?",
        translation: "Are you from Guadalajara?",
        translationOrders: { invalid: ["You are from Guadalajara?"] },
      },
      {
        orders: { valid: ["¿Tienes tiempo tú?", "¿Tienes tú tiempo?"] },
        sentence: "¿Tú tienes tiempo?",
        translation: "Do you have time?",
        translationOrders: {},
      },
      {
        orders: { valid: ["¿Tiene tiempo usted?", "¿Tiene usted tiempo?"] },
        sentence: "¿Usted tiene tiempo?",
        translation: "Do you have time?",
        translationOrders: {},
      },
    ],
    targetLanguage: "es",
  }),
  labeledCase({
    id: "en-zh-table-production",
    learnerLanguage: "en",
    origin: "production",
    sentences: [
      {
        orders: { invalid: ["位子有吗？请问", "有位子吗？请问"], unscored: ["请问，位子有吗？"] },
        sentence: "请问，有位子吗？",
        translation: "Excuse me, is there a table available?",
        translationOrders: {},
      },
      {
        orders: {
          invalid: ["位子有吗？现在", "有位子吗？现在"],
          unscored: ["位子现在有吗？", "现在位子有吗？"],
        },
        sentence: "现在有位子吗？",
        translation: "Is there a table available now?",
        translationOrders: {
          invalid: ["Is there a table now available?"],
          unscored: ["Is there now a table available?"],
          valid: ["Now, is there a table available?"],
        },
      },
      {
        orders: { valid: ["有，位子还有"] },
        sentence: "有，还有位子",
        translation: "Yes, there are still tables available",
        translationOrders: {
          invalid: [
            "There are available tables still, yes",
            "There are tables available still, yes",
            "Yes, there are available tables still",
            "Yes, there are tables available still",
          ],
          unscored: ["There are still available tables, yes"],
          valid: [
            "There are still tables available, yes",
            "There are tables still available, yes",
            "There still are tables available, yes",
            "Yes, there are still available tables",
            "Yes, there are tables still available",
            "Yes, there still are tables available",
          ],
        },
      },
      {
        orders: { valid: ["位子没有了"] },
        sentence: "没有位子了",
        translation: "There are no tables available anymore",
        translationOrders: { valid: ["There are no available tables anymore"] },
      },
    ],
    targetLanguage: "zh",
  }),
  labeledCase({
    id: "en-de-house-number-production",
    learnerLanguage: "en",
    origin: "production",
    sentences: [
      {
        orders: { valid: ["Mit null eins beginnt meine Nummer"] },
        sentence: "Meine Nummer beginnt mit null eins",
        translation: "My number starts with zero one",
        translationOrders: {},
      },
      {
        orders: { valid: ["Zwei, drei und vier kommen dann"] },
        sentence: "Dann kommen zwei, drei und vier",
        translation: "Then come two, three and four",
        translationOrders: {
          invalid: ["Two, three and four, then come"],
          unscored: ["Then two, three and four come", "Two, three and four come then"],
        },
      },
      {
        orders: {
          invalid: ["Die Hausnummer ist sechs?", "Sechs ist die Hausnummer?"],
          unscored: ["Ist sechs die Hausnummer?"],
        },
        sentence: "Ist die Hausnummer sechs?",
        translation: "Is the house number six?",
        translationOrders: {
          invalid: ["Six is the house number?", "The house number is six?"],
          unscored: ["Is six the house number?"],
        },
      },
    ],
    targetLanguage: "de",
  }),
];
