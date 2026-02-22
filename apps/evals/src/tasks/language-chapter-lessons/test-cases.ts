const SHARED_EXPECTATIONS = `
  - Each lesson should cover a SINGLE, SPECIFIC concept that can be explained within 10 short tweets
  - Break down topics into the smallest, most manageable units possible, so that each lesson can be learned in 2-3 minutes
  - If a topic is too broad, split it into multiple lessons
  - Each lesson should be extremely focused on a SINGLE concept
  - Each lesson must cover a SINGLE concept. Using "AND", "OR", "VS" (or their equivalents in other languages like "e", "ou", "y", "o", or symbols like "+", "・", "→") in a title is a signal it MAY be too broad — but it is acceptable when the comparison or pairing IS the concept itself. For example, "Ser vs Estar: Listo" (one adjective's meaning change is the lesson), "Been to vs. Gone to" (the distinction is the concept), or "する e くる" (the only two irregular verbs taught as a natural pair) are all valid single-concept lessons. Only penalize when AND/OR/VS joins genuinely separate concepts that deserve their own lessons (e.g., "Greetings and Introductions" or "Time and Dates" where each half is a full topic)
  - ALL lessons must be about pure language acquisition (vocabulary, grammar, pronunciation, sentences, conjugations, dialogues)
  - NO culture lessons (history, traditions, cuisine, festivals)
  - NO career or professional lessons
  - NO proficiency exam preparation lessons
  - NO literature or media analysis lessons
  - Lesson titles should be short and specific to the exact concept covered
  - Build a logical progression from basic to advanced concepts
  - Ensure lessons build on knowledge from previous lessons
  - Focus lessons for this specific chapter, not the entire course
  - Don't include summary or review lessons
  - Don't include assessment or quiz lessons
  - Should follow the language specified by language parameter
  - Should follow title and description guidelines: no fluff, be concise, straight to the point
  - Descriptions should be concise, no fluff (avoid "learn", "understand", "explore", etc.)
  - You don't need to evaluate the output format here, just focus on the lesson content quality
  - Include an extensive list of lessons to cover all the concepts needed for the chapter
`;

// Chapter titles and descriptions sourced from language-course-chapters
// eval outputs (openai/gpt-5.2) to test with real upstream data.
// Chapters picked from different course levels (initial, mid-early, mid-late, final).
export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English
      - Should cover regular -ar, -er, -ir conjugation patterns as separate lessons
      - Should include key irregular verbs (ser, estar, tener, ir) with individual lessons
      - Should include everyday action verbs and basic sentence patterns
      - Should not cover other tense forms (past, future, subjunctive verb conjugations). Common present-tense constructions of listed irregulars (e.g., tener que, ir a + infinitive) and present-tense semantic functions (habits, facts, scheduled future) are in scope since they use the present-tense form

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-present-tense",
    userInput: {
      chapterDescription:
        "Regular present-tense conjugations, essential irregulars (ser, estar, tener, ir), and everyday action verbs.",
      chapterTitle: "Present Tense",
      targetLanguage: "es",
      userLanguage: "en",
    },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should cover second conditional structure (if + past simple, would + base form)
      - Should have separate lessons for "would", "could", and "might" in hypothetical contexts
      - Should include forming and answering hypothetical questions
      - Should not cover first conditional (real situations) or third conditional (past regrets)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-english-hypothetical-conditionals",
    userInput: {
      chapterDescription:
        'Situaciones hipotéticas en presente y futuro. Segunda condicional, "would" y variaciones con "could/might".',
      chapterTitle: "Condicionales hipotéticas",
      targetLanguage: "en",
      userLanguage: "es",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover 〜そうだ for appearance and 〜そうだ for hearsay as distinct concepts
      - Should have separate lessons for 〜らしい and 〜みたい
      - Should cover register differences between these inference expressions
      - Should not go into unrelated grammar or verb forms outside appearance/inference

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-japanese-appearance-inference",
    userInput: {
      chapterDescription:
        "Expressões de aparência e suposição: 〜そうだ (aparência e boato), 〜らしい, 〜みたい e diferenças de registro.",
      chapterTitle: "Aparência e Inferência",
      targetLanguage: "ja",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should cover connotation differences between near-synonyms
      - Should include register sensitivity in word choice
      - Should cover subtle meaning shifts and context-dependent word selection
      - Should not overlap with grammar-focused or idiom-focused chapters. Register-related lexical choices (e.g., on vs nous, ça vs cela) are in scope since register sensitivity is a chapter topic
      - Lessons should be anchored in concrete French synonym sets or word pairs, not abstract linguistic theory

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-french-semantic-nuance",
    userInput: {
      chapterDescription:
        "Near-native nuance: connotation, register sensitivity, and subtle meaning shifts in synonyms.",
      chapterTitle: "Semantic Nuance & Synonyms",
      targetLanguage: "fr",
      userLanguage: "en",
    },
  },
];
