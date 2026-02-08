const SHARED_EXPECTATIONS = `
  - Chapters should follow CEFR progression from A1 (beginner) to C2 (mastery)
  - ALL chapters must be content-domain chapters: grammar structures, vocabulary themes, or communication scenarios
  - NO skill-based chapters (pronunciation, listening, reading, writing) — those skills are built into every lesson automatically
  - NO culture chapters (history, traditions, cuisine, music, festivals, customs)
  - NO career or professional chapters (business language, workplace communication)
  - NO proficiency exam preparation chapters (DELE, JLPT, DELF, HSK, etc.)
  - NO literature or media chapters (books, films, songs, poetry)
  - Should cover grammar structures (verb tenses, nouns, articles, etc.) and vocabulary themes (food, travel, health, etc.)
  - Should follow the language specified by language parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Titles should be concise, no filler words
  - Descriptions should be concise, no fluff (avoid "learn", "understand", "explore", etc.)
  - You don't need to evaluate the output format here, just focus on the chapter content quality
  - Don't add capstone/final projects, assessments, or exercises
`;

export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English (teaching Spanish)
      - Should cover Spanish-specific grammar structures (ser vs estar, subjunctive, preterite vs imperfect, etc.)
      - Should cover vocabulary themes relevant to everyday Spanish (food, travel, family, etc.)
      - Should cover communication scenarios (greetings, ordering food, asking directions, etc.)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-learning-spanish",
    userInput: { courseTitle: "Spanish", language: "en", targetLanguage: "es" },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese (teaching Japanese)
      - Should include dedicated chapters for writing systems (hiragana, katakana, kanji)
      - Should cover Japanese-specific grammar (particles, verb forms, honorifics, counters)
      - Should cover vocabulary themes and communication scenarios

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-learning-japanese",
    userInput: { courseTitle: "Japonês", language: "pt", targetLanguage: "ja" },
  },
  {
    expectations: `
      - MUST be in US English (teaching French)
      - Should cover French-specific grammar (gender/articles, subjunctive, past tenses, etc.)
      - Should cover vocabulary themes for everyday French situations (food, travel, etc.)
      - Should cover communication scenarios (greetings, shopping, etc.)

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-learning-french",
    userInput: { courseTitle: "French", language: "en", targetLanguage: "fr" },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish (teaching English)
      - Should cover English grammar structures (tenses, articles, phrasal verbs, conditionals)
      - Should cover vocabulary themes and communication scenarios
      - Should interleave grammar and vocabulary/situation chapters

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-learning-english",
    userInput: { courseTitle: "Inglés", language: "es", targetLanguage: "en" },
  },
];
