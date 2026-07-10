import { type TestCase } from "@/lib/types";
import { type LessonRomanizationParams } from "@zoonk/ai/tasks/lessons/language/romanization";
import { type LessonRomanizationExpected, type RomanizationExpectation } from "./scorer";

type LessonRomanizationTestCase = TestCase<LessonRomanizationExpected, LessonRomanizationParams>;

/**
 * Pairs each source text with its accepted Roman-script forms. Structured gold
 * values make linguistic correctness deterministic without duplicating a
 * prose rubric for a judge model.
 */
function lessonRomanizationCase({
  id,
  romanizations,
  targetLanguage,
  texts,
}: {
  id: string;
  romanizations: readonly RomanizationExpectation[];
  targetLanguage: string;
  texts: string[];
}): LessonRomanizationTestCase {
  return { expected: { romanizations }, id, userInput: { targetLanguage, texts } };
}

export const TEST_CASES: LessonRomanizationTestCase[] = [
  lessonRomanizationCase({
    id: "ja-basic-phrases",
    romanizations: [
      { accepted: ["konnichiwa"] },
      { accepted: ["Tōkyō Tawā"] },
      { accepted: ["ogenki desu ka"] },
    ],
    targetLanguage: "ja",
    texts: ["こんにちは", "東京タワー", "お元気ですか"],
  }),
  lessonRomanizationCase({
    id: "zh-basic-phrases",
    romanizations: [
      { accepted: ["nǐ hǎo"] },
      { accepted: ["xièxie"] },
      { accepted: ["Zhōngguó rén", "Zhōngguórén"] },
    ],
    targetLanguage: "zh",
    texts: ["你好", "谢谢", "中国人"],
  }),
  lessonRomanizationCase({
    id: "ko-basic-phrases",
    romanizations: [
      { accepted: ["annyeonghaseyo"] },
      { accepted: ["gamsahamnida"] },
      { accepted: ["Daehanminguk"] },
    ],
    targetLanguage: "ko",
    texts: ["안녕하세요", "감사합니다", "대한민국"],
  }),
  lessonRomanizationCase({
    id: "ar-basic-words",
    romanizations: [{ accepted: ["marḥaban"] }, { accepted: ["shukran"] }, { accepted: ["kitāb"] }],
    targetLanguage: "ar",
    texts: ["مرحبا", "شكرا", "كتاب"],
  }),
  lessonRomanizationCase({
    id: "ru-basic-phrases",
    romanizations: [
      { accepted: ["Zdravstvuyte"] },
      { accepted: ["Spasibo"] },
      { accepted: ["Moskva"] },
    ],
    targetLanguage: "ru",
    texts: ["Здравствуйте", "Спасибо", "Москва"],
  }),
  lessonRomanizationCase({
    id: "th-basic-phrases",
    romanizations: [
      { accepted: ["sawatdi"] },
      { accepted: ["khop khun", "khopkhun"] },
      { accepted: ["Krung Thep", "Krungthep"] },
    ],
    targetLanguage: "th",
    texts: ["สวัสดี", "ขอบคุณ", "กรุงเทพ"],
  }),
  lessonRomanizationCase({
    id: "ja-full-sentences",
    romanizations: [
      { accepted: ["watashi wa gakusei desu"] },
      { accepted: ["Tōkyō wa ōkii toshi desu"] },
      {
        accepted: ["mainichi nihongo o benkyō shite imasu", "mainichi nihongo o benkyō shiteimasu"],
      },
    ],
    targetLanguage: "ja",
    texts: ["私は学生です", "東京は大きい都市です", "毎日日本語を勉強しています"],
  }),
  lessonRomanizationCase({
    id: "hi-basic-words",
    romanizations: [
      { accepted: ["namaste"] },
      { accepted: ["dhanyavād"] },
      { accepted: ["Bhārat"] },
    ],
    targetLanguage: "hi",
    texts: ["नमस्ते", "धन्यवाद", "भारत"],
  }),
  lessonRomanizationCase({
    id: "el-proper-nouns",
    romanizations: [
      { accepted: ["Elláda"] },
      { accepted: ["Athína"] },
      { accepted: ["Thessalía"] },
    ],
    targetLanguage: "el",
    texts: ["Ελλάδα", "Αθήνα", "Θεσσαλία"],
  }),
  lessonRomanizationCase({
    id: "zh-mixed-script-punctuation",
    romanizations: [
      { accepted: ["OpenAI zài Běijīng"] },
      { accepted: ["Nǐ hǎo, Wáng lǎoshī!"] },
      { accepted: ["hànyǔ"] },
    ],
    targetLanguage: "zh",
    texts: ["OpenAI在北京", "你好，王老师！", "汉语"],
  }),
];
