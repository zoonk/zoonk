const SHARED_EXPECTATIONS = `
  - Chapters should follow CEFR progression from A1 (beginner) to C2 (mastery)
  - ALL chapters must be content-domain chapters: grammar structures, vocabulary themes, or communication scenarios
  - NO skill-based chapters that are explicitly about practicing a skill in isolation (e.g., "Pronunciation Practice", "Listening Exercises", "Writing Workshop", "Reading Comprehension") — those skills are built into every lesson automatically. However, content chapters that USE these skills as a vehicle for teaching language are valid: "Complex Texts & Critical Analysis" (advanced vocabulary/comprehension), "Formal Correspondence" (grammar/expressions for letters), "Academic Discourse" (register/vocabulary). The test: is the chapter about the skill itself, or about language content delivered through that medium?
  - NO culture chapters that teach about a country/region's history, traditions, or customs as the primary content (e.g., "History of France", "Japanese Festivals", "Brazilian Carnival"). However, vocabulary chapters that teach culture-related words and expressions ARE valid: "Arts & Entertainment Vocabulary" (how to discuss art, music, film in the target language), "Food & Dining" (restaurant vocabulary, ordering expressions), "News & Media Language" (media-related vocabulary/register). The test: is the chapter teaching ABOUT the culture, or teaching language THROUGH cultural topics?
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
    userInput: { targetLanguage: "es", userLanguage: "en" },
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
    userInput: { targetLanguage: "ja", userLanguage: "pt" },
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
    userInput: { targetLanguage: "fr", userLanguage: "en" },
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
    userInput: { targetLanguage: "en", userLanguage: "es" },
  },
];
