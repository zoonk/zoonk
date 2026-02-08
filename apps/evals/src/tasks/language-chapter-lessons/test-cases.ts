const SHARED_EXPECTATIONS = `
  - Each lesson should cover a SINGLE, SPECIFIC concept that can be explained within 10 short tweets
  - Break down topics into the smallest, most manageable units possible, so that each lesson can be learned in 2-3 minutes
  - If a topic is too broad, split it into multiple lessons
  - Each lesson should be extremely focused on a SINGLE concept
  - If you find yourself using "AND", "OR", or "VS" in a title, you should split it into separate lessons
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

export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English
      - Should break down present tense verb conjugations individually
      - Should have separate lessons for ser and estar
      - Should cover regular -ar, -er, -ir verb patterns separately

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-present-tense",
    userInput: {
      chapterDescription:
        "Regular and irregular verb conjugations in the present tense for everyday actions.",
      chapterTitle: "Present Tense Verbs",
      courseTitle: "Spanish",
      language: "en",
      targetLanguage: "es",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should break down hiragana by character groups (vowels, k-row, s-row, etc.)
      - Should cover stroke order and pronunciation for each group
      - Should not go beyond hiragana into katakana or kanji

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-japanese-hiragana",
    userInput: {
      chapterDescription:
        "The hiragana syllabary: basic characters, dakuten, handakuten, and combination characters.",
      chapterTitle: "Hiragana",
      courseTitle: "Japonês",
      language: "pt",
      targetLanguage: "ja",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should separate formal and informal greetings
      - Should cover common phrases individually
      - Should include time-of-day greetings as separate lessons

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-french-greetings",
    userInput: {
      chapterDescription:
        "Common greetings, introductions, and polite expressions for everyday encounters.",
      chapterTitle: "Basic Greetings & Introductions",
      courseTitle: "French",
      language: "en",
      targetLanguage: "fr",
    },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should break down past tenses individually (simple past, past continuous, etc.)
      - Should cover regular and irregular verbs separately
      - Should not combine multiple tense types in a single lesson

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-english-past-tenses",
    userInput: {
      chapterDescription:
        "Simple past, past continuous, present perfect, and past perfect tenses with regular and irregular verbs.",
      chapterTitle: "Tiempos Pasados",
      courseTitle: "Inglés",
      language: "es",
      targetLanguage: "en",
    },
  },
];
