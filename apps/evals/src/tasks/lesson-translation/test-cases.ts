import { type TestCase } from "@/lib/types";
import { type TranslationParams } from "@zoonk/ai/tasks/lessons/language/translation";
import { type LessonTranslationExpected } from "./scorer";

type LessonTranslationTestCase = TestCase<LessonTranslationExpected, TranslationParams>;

type LessonTranslationCaseParams = LessonTranslationExpected &
  Pick<TranslationParams, "targetLanguage" | "userLanguage" | "word"> & { id: string };

/**
 * Pairs one standalone source word with every accepted concise dictionary
 * translation. Structured gold values make correctness deterministic without
 * duplicating a prose rubric for a judge model.
 */
function lessonTranslationCase({
  accepted,
  id,
  targetLanguage,
  userLanguage,
  word,
}: LessonTranslationCaseParams): LessonTranslationTestCase {
  return { expected: { accepted }, id, userInput: { targetLanguage, userLanguage, word } };
}

export const TEST_CASES: LessonTranslationTestCase[] = [
  lessonTranslationCase({
    accepted: ["the"],
    id: "es-en-el",
    targetLanguage: "es",
    userLanguage: "en",
    word: "el",
  }),
  lessonTranslationCase({
    accepted: ["cat"],
    id: "es-en-gato",
    targetLanguage: "es",
    userLanguage: "en",
    word: "gato",
  }),
  lessonTranslationCase({
    accepted: ["eating"],
    id: "es-en-comiendo",
    targetLanguage: "es",
    userLanguage: "en",
    word: "comiendo",
  }),
  lessonTranslationCase({
    accepted: ["cat"],
    id: "ja-en-neko",
    targetLanguage: "ja",
    userLanguage: "en",
    word: "猫",
  }),
  lessonTranslationCase({
    accepted: ["eat", "to eat"],
    id: "ja-en-taberu",
    targetLanguage: "ja",
    userLanguage: "en",
    word: "食べる",
  }),
  lessonTranslationCase({
    accepted: ["the"],
    id: "de-en-der",
    targetLanguage: "de",
    userLanguage: "en",
    word: "der",
  }),
  lessonTranslationCase({
    accepted: ["dog"],
    id: "de-en-hund",
    targetLanguage: "de",
    userLanguage: "en",
    word: "Hund",
  }),
  lessonTranslationCase({
    accepted: ["gato"],
    id: "ko-pt-goyangi",
    targetLanguage: "ko",
    userLanguage: "pt",
    word: "고양이",
  }),
  lessonTranslationCase({
    accepted: ["comer"],
    id: "ko-pt-meokda",
    targetLanguage: "ko",
    userLanguage: "pt",
    word: "먹다",
  }),
  lessonTranslationCase({
    accepted: ["gata", "gato"],
    id: "ar-es-qitta",
    targetLanguage: "ar",
    userLanguage: "es",
    word: "قطة",
  }),
  lessonTranslationCase({
    accepted: ["en"],
    id: "ar-es-fi",
    targetLanguage: "ar",
    userLanguage: "es",
    word: "في",
  }),
  lessonTranslationCase({
    accepted: ["la casa", "el hogar"],
    id: "ar-es-albayt",
    targetLanguage: "ar",
    userLanguage: "es",
    word: "البيت",
  }),
  lessonTranslationCase({
    accepted: ["houses", "homes"],
    id: "de-en-haeuser",
    targetLanguage: "de",
    userLanguage: "en",
    word: "Häuser",
  }),
  lessonTranslationCase({
    accepted: ["pregnant", "expecting"],
    id: "es-en-embarazada",
    targetLanguage: "es",
    userLanguage: "en",
    word: "embarazada",
  }),
  lessonTranslationCase({
    accepted: ["girl"],
    id: "es-en-nina",
    targetLanguage: "es",
    userLanguage: "en",
    word: "niña",
  }),
  lessonTranslationCase({
    accepted: ["bookstore", "book store", "bookshop", "book shop"],
    id: "fr-en-librairie",
    targetLanguage: "fr",
    userLanguage: "en",
    word: "librairie",
  }),
  lessonTranslationCase({
    accepted: ["poison"],
    id: "de-en-gift",
    targetLanguage: "de",
    userLanguage: "en",
    word: "Gift",
  }),
  lessonTranslationCase({
    accepted: ["relatives"],
    id: "it-en-parenti",
    targetLanguage: "it",
    userLanguage: "en",
    word: "parenti",
  }),
  lessonTranslationCase({
    accepted: ["bicycle", "bike", "cycle"],
    id: "pl-en-rower",
    targetLanguage: "pl",
    userLanguage: "en",
    word: "rower",
  }),
  lessonTranslationCase({
    accepted: ["letter"],
    id: "ja-en-tegami",
    targetLanguage: "ja",
    userLanguage: "en",
    word: "手紙",
  }),
  lessonTranslationCase({
    accepted: ["árbol"],
    id: "en-es-tree",
    targetLanguage: "en",
    userLanguage: "es",
    word: "tree",
  }),
  lessonTranslationCase({
    accepted: ["coração"],
    id: "en-pt-heart",
    targetLanguage: "en",
    userLanguage: "pt",
    word: "heart",
  }),
  lessonTranslationCase({
    accepted: ["café"],
    id: "en-fr-coffee",
    targetLanguage: "en",
    userLanguage: "fr",
    word: "coffee",
  }),
  lessonTranslationCase({
    accepted: ["book"],
    id: "ru-en-kniga",
    targetLanguage: "ru",
    userLanguage: "en",
    word: "книга",
  }),
  lessonTranslationCase({
    accepted: ["and"],
    id: "ru-en-i",
    targetLanguage: "ru",
    userLanguage: "en",
    word: "и",
  }),
  lessonTranslationCase({
    accepted: ["agua"],
    id: "hi-es-paani",
    targetLanguage: "hi",
    userLanguage: "es",
    word: "पानी",
  }),
  lessonTranslationCase({
    accepted: ["sea"],
    id: "el-en-thalassa",
    targetLanguage: "el",
    userLanguage: "en",
    word: "θάλασσα",
  }),
  lessonTranslationCase({
    accepted: ["dog"],
    id: "he-en-kelev",
    targetLanguage: "he",
    userLanguage: "en",
    word: "כלב",
  }),
  lessonTranslationCase({
    accepted: ["livro"],
    id: "zh-pt-shu",
    targetLanguage: "zh",
    userLanguage: "pt",
    word: "书",
  }),
  lessonTranslationCase({
    accepted: ["books"],
    id: "tr-en-kitaplar",
    targetLanguage: "tr",
    userLanguage: "en",
    word: "kitaplar",
  }),
  lessonTranslationCase({
    accepted: ["my house", "my home", "my place"],
    id: "tr-en-evim",
    targetLanguage: "tr",
    userLanguage: "en",
    word: "evim",
  }),
  lessonTranslationCase({
    accepted: ["livre"],
    id: "th-fr-nangsue",
    targetLanguage: "th",
    userLanguage: "fr",
    word: "หนังสือ",
  }),
  lessonTranslationCase({
    accepted: ["chat"],
    id: "id-fr-kucing",
    targetLanguage: "id",
    userLanguage: "fr",
    word: "kucing",
  }),
  lessonTranslationCase({
    accepted: ["猫", "ねこ", "ネコ"],
    id: "en-ja-cat",
    targetLanguage: "en",
    userLanguage: "ja",
    word: "cat",
  }),
];
