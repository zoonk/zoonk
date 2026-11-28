import { type TestCase } from "@/lib/types";
import { type LanguageLessonActivitiesParams } from "@zoonk/ai/tasks/language/language-lesson";
import { LANGUAGE_LESSONS } from "../language-lesson-check/language-lessons";
import { type LanguageLessonCheckInput } from "../language-lesson-check/test-cases";

export type LanguageLessonActivitiesInput = Omit<
  LanguageLessonActivitiesParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "speed" | "useFallback"
>;

/** Whether each screen belongs in the lesson; a missing key means either answer is fine. */
export type LanguageLessonActivitiesExpected = { dialogue?: boolean; patternTable?: boolean };

function published({ lesson, writer }: LanguageLessonCheckInput): LanguageLessonActivitiesInput {
  const examples = lesson.tip.examples.map(
    ({ sentence, translation }) => `- \`${sentence}\`: ${translation}`,
  );

  return {
    ...writer,
    lesson: {
      sentences: lesson.sentences.map(({ sentence, translation }) => ({ sentence, translation })),
      tip: { text: [lesson.tip.text, ...examples].join("\n\n"), title: lesson.tip.title },
      words: lesson.words.map(({ translation, word }) => ({ translation, word })),
    },
  };
}

function productionLesson({
  canDo,
  description,
  learnerLanguage,
  lesson,
  targetLanguage,
  title,
}: {
  canDo: string;
  description: string;
  learnerLanguage: string;
  lesson: LanguageLessonActivitiesInput["lesson"];
  targetLanguage: string;
  title: string;
}): LanguageLessonActivitiesInput {
  return {
    learnerLanguage,
    lesson,
    lessonCanDo: canDo,
    lessonDescription: description,
    lessonTitle: title,
    level: "A1",
    targetLanguage,
    unitCanDos: [],
    unitTitle: title,
  };
}

const { englishIntroductions, italianGreetings, italianPastWeather, spanishSlowly } =
  LANGUAGE_LESSONS;

const CONVERSATION = `The dialogue's lines and best reply use this lesson's own words, sentences and tip, at its level, so the learner answers with what they just learned; the other person's last line is what the learner answers, and every wrong reply is wrong there for one reason a learner would fall for, never also a fine thing to say.`;

const TABLE = `The table shows the tip's own set of endings on one word and has the learner complete another word from the lesson's situation that follows it in every row; each blank's right ending is the longest choice its answer ends with.`;

export const TEST_CASES: TestCase<
  LanguageLessonActivitiesExpected,
  LanguageLessonActivitiesInput
>[] = [
  {
    expectations: `A dialogue where someone greets the learner in the morning or evening and asks how they are. ${CONVERSATION} The tip is about which greeting to use, not a set of endings, so there's no table.`,
    expected: { dialogue: true, patternTable: false },
    id: "pt-it-greetings",
    userInput: published(italianGreetings),
  },
  {
    expectations: `A dialogue with a stranger (a clerk or a doctor) who speaks too fast, where the best reply asks politely with “¿Puede…?”. ${CONVERSATION} No table: the tip is one polite form.`,
    expected: { dialogue: true, patternTable: false },
    id: "en-es-speak-slowly",
    userInput: published(spanishSlowly),
  },
  {
    expectations: `A dialogue where someone asks the learner's name or where they're from. ${CONVERSATION} No table.`,
    expected: { dialogue: true, patternTable: false },
    id: "pt-en-introductions",
    userInput: published(englishIntroductions),
  },
  {
    expectations: `When there's a dialogue, someone asks how the weather was and the best reply uses the imperfect the tip teaches. ${CONVERSATION} The tip is about using the imperfect for weather, not a set of endings to complete, so there's no table.`,
    expected: { patternTable: false },
    id: "pt-it-past-weather",
    userInput: published(italianPastWeather),
  },
  {
    expectations: `A table of a regular verb's present-tense endings (lernen to spielen, or another regular verb from the lesson), with the rows labeled by pronoun. ${TABLE} A dialogue is optional; if there is one, ${CONVERSATION}`,
    expected: { patternTable: true },
    id: "en-de-regular-verb-endings",
    origin: "production",
    userInput: productionLesson({
      canDo: "Use regular German verb endings in short statements",
      description: "Subject pronouns, verb endings, and question words build short conversations.",
      learnerLanguage: "en",
      lesson: {
        sentences: [
          { sentence: "Ich lerne Deutsch", translation: "I'm learning German" },
          { sentence: "Wir lernen Deutsch", translation: "We're learning German" },
          { sentence: "Ich spiele Fußball", translation: "I play soccer" },
          { sentence: "Lernen Sie Deutsch?", translation: "Are you learning German?" },
        ],
        tip: {
          text: "To make a statement, put the person first and the verb next. With `ich`, regular verbs like `lernen` end in `-e`: `Ich lerne Deutsch` means “I'm learning German.” With `wir` or polite `Sie`, they end in `-en`: `Wir lernen Deutsch` means “We're learning German.” Unlike English, German changes the verb ending for these subjects.",
          title: "Regular verb endings in statements",
        },
        words: [
          { translation: "I", word: "ich" },
          { translation: "we", word: "wir" },
          { translation: "to learn", word: "lernen" },
          { translation: "to play", word: "spielen" },
        ],
      },
      targetLanguage: "de",
      title: "Present-tense sentences and questions",
    }),
  },
  {
    expectations: `A table of a nationality word's endings for a man, a woman and groups (mexicano to another nationality ending in -o). ${TABLE} A dialogue is optional; if there is one, ${CONVERSATION}`,
    expected: { patternTable: true },
    id: "en-es-nationality-endings",
    origin: "production",
    userInput: productionLesson({
      canDo: "Describe your nationality and other people’s nationalities",
      description:
        "Use nationality words ending in -o or -e with ser, choosing endings that fit an individual or group.",
      learnerLanguage: "en",
      lesson: {
        sentences: [
          { sentence: "Soy mexicana", translation: "I'm Mexican" },
          { sentence: "¿Usted es canadiense?", translation: "Are you Canadian?" },
          { sentence: "Somos mexicanos", translation: "We're Mexican" },
          { sentence: "Ellas son canadienses", translation: "They're Canadian" },
        ],
        tip: {
          text: "Unlike English nationality words, some Spanish ones change to fit the person or group. For one person, use `mexicano` for a man and `mexicana` for a woman; `canadiense` works for either. For a group, use `mexicanos` for men or a mixed group, `mexicanas` for women, and `canadienses` for any group.\n\n- `Soy mexicano`: I'm Mexican\n- `Somos mexicanas`: We're Mexican\n- `Ellas son canadienses`: They're Canadian",
          title: "Nationality endings",
        },
        words: [
          { translation: "I am", word: "soy" },
          { translation: "we are", word: "somos" },
          { translation: "Mexican, for a man", word: "mexicano" },
          { translation: "Mexican, for a woman", word: "mexicana" },
          { translation: "Canadian", word: "canadiense" },
        ],
      },
      targetLanguage: "es",
      title: "Nationalities with ser",
    }),
  },
  {
    expectations: `Neither screen: the lesson is about hearing vowels, and a dialogue's written lines would show the word the learner should hear.`,
    expected: { dialogue: false, patternTable: false },
    id: "en-de-vowel-sounds",
    origin: "production",
    userInput: productionLesson({
      canDo: "Distinguish common German vowels by their sound and length",
      description: "German vowels and umlauts distinguish words such as schon and schön.",
      learnerLanguage: "en",
      lesson: {
        sentences: [
          { sentence: "Ich bin schon hier", translation: "I’m already here" },
          { sentence: "Die Wohnung ist schön", translation: "The apartment is nice" },
          { sentence: "Die Miete beträgt 800 €", translation: "The rent is 800 euros" },
          {
            sentence: "Treffen wir uns in der Mitte?",
            translation: "Shall we meet in the middle?",
          },
        ],
        tip: {
          text: "In `schon`, the vowel is like a steady “oh”; in `schön`, round your lips while saying the different vowel. In `Miete`, the vowel is a long “ee,” while in `Mitte` it is short, like the vowel in “sit.” These differences change the meaning, so listen to the whole vowel rather than relying on the spelling.",
          title: "Listen for vowel quality and length",
        },
        words: [
          { translation: "already", word: "schon" },
          { translation: "nice", word: "schön" },
          { translation: "the rent", word: "die Miete" },
          { translation: "the middle", word: "die Mitte" },
        ],
      },
      targetLanguage: "de",
      title: "German vowels and umlauts",
    }),
  },
  {
    expectations: `Neither screen: the learner reads signs in a public place, which isn't a conversation they take part in, and the tip is a fixed sentence pattern, not a set of endings.`,
    expected: { dialogue: false, patternTable: false },
    id: "pt-en-public-signs",
    origin: "production",
    userInput: productionLesson({
      canDo: "Interpretar placas comuns para circular em locais públicos",
      description: "Palavras como entrance, exit e closed ajudam a interpretar placas frequentes.",
      learnerLanguage: "pt",
      lesson: {
        sentences: [
          { sentence: "The entrance is open", translation: "A entrada está aberta" },
          { sentence: "The exit is closed", translation: "A saída está fechada" },
          { sentence: "Is the entrance open?", translation: "A entrada está aberta?" },
          { sentence: "Use the other exit", translation: "Use a outra saída" },
        ],
        tip: {
          text: "Para dizer que uma entrada ou saída está aberta ou fechada, use `the` + o local + `is` + `open` ou `closed`. Por exemplo: `The entrance is open` significa “A entrada está aberta”; `The exit is closed` significa “A saída está fechada”. Não esqueça o `is`, que corresponde a “está” nessas frases.\n\n- `The entrance is open`: A entrada está aberta\n- `The exit is closed`: A saída está fechada",
          title: "Dizer se um local está aberto ou fechado",
        },
        words: [
          { translation: "a entrada", word: "entrance" },
          { translation: "a saída", word: "exit" },
          { translation: "aberto", word: "open" },
          { translation: "fechado", word: "closed" },
        ],
      },
      targetLanguage: "en",
      title: "Placas de locais públicos",
    }),
  },
];
