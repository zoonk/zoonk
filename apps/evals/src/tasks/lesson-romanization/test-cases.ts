const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. ROMANIZATION ACCURACY (CRITICAL - highest priority):
   - Each romanization must use the standard system for the target language
   - Japanese: Hepburn romaji
   - Chinese: Pinyin (with tone marks or numbers)
   - Korean: Revised Romanization
   - Arabic: ISO or common scholarly romanization
   - Russian/Ukrainian/Bulgarian: ISO 9 or BGN/PCGN
   - Thai: RTGS (Royal Thai General System)
   - Hindi/Kannada/Tamil/Nepali/Marathi: IAST or Hunterian
   - Penalize SEVERELY for incorrect romanization or wrong system

2. COMPLETENESS:
   - Must return exactly one romanization per input text
   - Number of romanizations must match number of input texts
   - No texts should be skipped or merged
   - Penalize if count does not match

3. ORDER PRESERVATION:
   - Romanizations must be in the same order as input texts
   - The romanization at index N must correspond to the text at index N
   - Penalize if order is scrambled

4. READABILITY:
   - Romanization should be readable by someone familiar with the Latin alphabet
   - Word boundaries should be preserved
   - Penalize if romanization is unreadable or omits significant sounds

5. NO TRANSLATION:
   - Romanizations must be transliterations, NOT translations
   - The output should represent the sounds of the original text, not its meaning
   - Penalize SEVERELY if the output is a translation instead of a romanization

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact character-by-character matches
- Accept minor stylistic variations (e.g., macrons vs. doubled vowels in Japanese)
- FOCUS ON: system correctness, phonetic accuracy, completeness, order
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Japanese

TEXTS:
1. "こんにちは" (a common greeting)
2. "東京タワー" (Tokyo Tower)
3. "お元気ですか" (How are you?)

EXPECTED ROMANIZATION SYSTEM: Hepburn romaji

ACCURACY PITFALLS:
- "は" as a particle should be romanized as "wa" (not "ha")
- Long vowels should be properly represented (e.g., "tou" or "tō" for 東)
- "ん" before certain consonants may vary but should be "n"
- "タワー" is katakana and should be romanized as "tawaa" or "tawā"

${SHARED_EXPECTATIONS}
    `,
    id: "ja-basic-phrases",
    userInput: {
      targetLanguage: "ja",
      texts: ["こんにちは", "東京タワー", "お元気ですか"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Chinese (Mandarin)

TEXTS:
1. "你好" (hello)
2. "谢谢" (thank you)
3. "中国人" (Chinese person)

EXPECTED ROMANIZATION SYSTEM: Pinyin

ACCURACY PITFALLS:
- Tone marks or tone numbers should be included
- "你好" = "nǐ hǎo" (tones 3, 3)
- "谢谢" = "xièxie" or "xièxiè" (tone 4, neutral/4)
- "中国人" = "zhōngguó rén" (tones 1, 2, 2)
- Penalize if tones are completely omitted

${SHARED_EXPECTATIONS}
    `,
    id: "zh-basic-phrases",
    userInput: {
      targetLanguage: "zh",
      texts: ["你好", "谢谢", "中国人"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean

TEXTS:
1. "안녕하세요" (hello/polite greeting)
2. "감사합니다" (thank you)
3. "대한민국" (Republic of Korea)

EXPECTED ROMANIZATION SYSTEM: Revised Romanization of Korean

ACCURACY PITFALLS:
- "안녕하세요" = "annyeonghaseyo"
- "감사합니다" = "gamsahamnida"
- "대한민국" = "daehanminguk"
- Korean romanization has specific rules for consonant assimilation
- Penalize if consonant assimilation rules are ignored

${SHARED_EXPECTATIONS}
    `,
    id: "ko-basic-phrases",
    userInput: {
      targetLanguage: "ko",
      texts: ["안녕하세요", "감사합니다", "대한민국"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Arabic

TEXTS:
1. "مرحبا" (hello)
2. "شكرا" (thank you)
3. "كتاب" (book)

EXPECTED ROMANIZATION SYSTEM: Standard scholarly or ISO romanization

ACCURACY PITFALLS:
- "مرحبا" = "marhaba" or "marḥabā"
- "شكرا" = "shukran" or "shukrān"
- "كتاب" = "kitab" or "kitāb"
- Arabic has emphatic consonants that may or may not be marked
- Accept variations in vowel length marking

${SHARED_EXPECTATIONS}
    `,
    id: "ar-basic-words",
    userInput: {
      targetLanguage: "ar",
      texts: ["مرحبا", "شكرا", "كتاب"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Russian

TEXTS:
1. "Здравствуйте" (hello/formal)
2. "Спасибо" (thank you)
3. "Москва" (Moscow)

EXPECTED ROMANIZATION SYSTEM: ISO 9 or BGN/PCGN

ACCURACY PITFALLS:
- "Здравствуйте" = "Zdravstvuyte" or "Zdravstvujte"
- "Спасибо" = "Spasibo"
- "Москва" = "Moskva"
- The "в" in "Здравствуйте" is silent in speech but should still be romanized
- Accept common transliteration variants (e.g., "j" vs "y" for "й")

${SHARED_EXPECTATIONS}
    `,
    id: "ru-basic-phrases",
    userInput: {
      targetLanguage: "ru",
      texts: ["Здравствуйте", "Спасибо", "Москва"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Thai

TEXTS:
1. "สวัสดี" (hello)
2. "ขอบคุณ" (thank you)
3. "กรุงเทพ" (Bangkok)

EXPECTED ROMANIZATION SYSTEM: RTGS (Royal Thai General System)

ACCURACY PITFALLS:
- "สวัสดี" = "sawatdi" or "sawasdee"
- "ขอบคุณ" = "khopkhun" or "khob khun"
- "กรุงเทพ" = "krungthep" or "krung thep"
- Thai tones are typically NOT marked in RTGS
- Accept common romanization variants

${SHARED_EXPECTATIONS}
    `,
    id: "th-basic-phrases",
    userInput: {
      targetLanguage: "th",
      texts: ["สวัสดี", "ขอบคุณ", "กรุงเทพ"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Japanese

TEXTS:
1. "私は学生です" (I am a student)
2. "東京は大きい都市です" (Tokyo is a big city)
3. "毎日日本語を勉強しています" (I study Japanese every day)

EXPECTED ROMANIZATION SYSTEM: Hepburn romaji

This tests longer sentences rather than short phrases.

ACCURACY PITFALLS:
- Particle "は" when topic marker = "wa"
- Particle "を" = "o" (not "wo" in modern Hepburn, though "wo" is also acceptable)
- "です" = "desu"
- "しています" = "shiteimasu" or "shite imasu"
- Word boundaries should be preserved in the romanization

${SHARED_EXPECTATIONS}
    `,
    id: "ja-full-sentences",
    userInput: {
      targetLanguage: "ja",
      texts: ["私は学生です", "東京は大きい都市です", "毎日日本語を勉強しています"],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Hindi

TEXTS:
1. "नमस्ते" (hello)
2. "धन्यवाद" (thank you)
3. "भारत" (India)

EXPECTED ROMANIZATION SYSTEM: IAST or Hunterian

ACCURACY PITFALLS:
- "नमस्ते" = "namaste" or "namastē"
- "धन्यवाद" = "dhanyavaad" or "dhanyavād"
- "भारत" = "bhaarat" or "bhārat"
- Aspirated consonants (bh, dh) must be preserved
- Retroflex consonants may or may not be specially marked

${SHARED_EXPECTATIONS}
    `,
    id: "hi-basic-words",
    userInput: {
      targetLanguage: "hi",
      texts: ["नमस्ते", "धन्यवाद", "भारत"],
    },
  },
];
