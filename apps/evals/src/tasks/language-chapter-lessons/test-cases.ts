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
      - Should have separate lessons for ser and estar uses
      - Should cover identity, origin, and location as distinct concepts
      - Should include basic sentence patterns with each verb
      - Should not go beyond present tense forms

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-ser-estar",
    userInput: {
      chapterDescription:
        "Ser vs. estar in the present, basic sentence patterns, and describing identity, origin, and location.",
      chapterTitle: "Ser & Estar (Present)",
      targetLanguage: "es",
      userLanguage: "en",
    },
  },
  {
    expectations: `
      - MUST be in Latin American Spanish
      - Should break down present perfect formation (have/has + past participle)
      - Should cover "ever/never" for experiences as separate lessons from "just/already/yet" for recent results
      - Should include irregular past participles individually
      - Should not cover other perfect tenses (past perfect, future perfect)

      ${SHARED_EXPECTATIONS}
    `,
    id: "es-english-present-perfect",
    userInput: {
      chapterDescription:
        'Presente perfecto con "ever/never/just/already/yet" para experiencias y resultados recientes.',
      chapterTitle: "Presente perfecto: experiencias y resultados",
      targetLanguage: "en",
      userLanguage: "es",
    },
  },
  {
    expectations: `
      - MUST be in Brazilian Portuguese
      - Should cover the causative form (〜させる) construction
      - Should have separate lessons for permission and compulsion meanings
      - Should cover particle combinations with causative verbs
      - Should not go into causative-passive (〜させられる)

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-japanese-causative",
    userInput: {
      chapterDescription:
        "Causativa: 〜させる, permitir/obrigar e combinações comuns com partículas.",
      chapterTitle: "Causativa",
      targetLanguage: "ja",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
      - MUST be in US English
      - Should cover implicature, presuppositions, and euphemism as distinct concepts
      - Should include pragmatic inference strategies
      - Should have lessons on interpreting implied meaning from context
      - Should not overlap with argumentation or debate topics

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-french-implied-meaning",
    userInput: {
      chapterDescription:
        "Understanding and producing implicit meaning and presuppositions. Implication, euphemism, and pragmatic inference.",
      chapterTitle: "Implied Meaning",
      targetLanguage: "fr",
      userLanguage: "en",
    },
  },
];
