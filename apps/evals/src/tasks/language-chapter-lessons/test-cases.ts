const SHARED_EXPECTATIONS = `
  # How to evaluate

  You are evaluating a LANGUAGE CURRICULUM. Think like a language curriculum designer reviewing a colleague's work — use expertise in second language acquisition and professional judgment, not mechanical rule-checking.

  ## Structure

  Output is organized into LESSON UNITS (thematic groups) containing CONCEPTS (individual language items).
  - Each concept should be a single, specific language item — one word/phrase, one grammar rule, one conjugation form, one pronunciation point, one dialogue pattern
  - Lesson sizes should be 3-8 concepts and should vary naturally across lessons
  - Total concept coverage should be exhaustive for the chapter's scope

  ## Evaluating concept quality

  Ask: "Is this ONE teachable language item, or is it secretly a bundle of separate items?"
  - A concept is too broad only if it genuinely bundles multiple DISTINCT language items that a student would need separate practice for
  - Conjunctions (AND/OR/VS and equivalents in any language) signal potential broadness, but only penalize when they join genuinely separate topics — not when the comparison itself IS the concept (e.g., "Ser vs Estar: Listo" where the meaning change IS the single concept)
  - Concept titles should be concrete and self-explanatory

  ## Content restrictions

  ALL concepts must be about pure language acquisition: vocabulary, grammar, pronunciation, sentences, conjugations, dialogues. No culture, career, exam prep, or literature content.

  ## Evaluating lesson quality

  - Lesson descriptions should be concise and go straight to the content — no filler words like "introduces", "presents", "teaches", "explores"
  - Logical progression from foundational to advanced
  - No summary, review, or assessment lessons
  - Should follow the specified language

  ## Coverage

  Completeness is the key metric. Are all language items in the chapter description covered with sufficient granularity?

  ## Proportionality

  Weight your scoring proportionally. A curriculum with strong coverage and structure but a few overly-broad concept titles is fundamentally different from one that misses entire topics. Minor title-phrasing issues should not dominate the score.
`;

// Chapter titles and descriptions sourced from language-course-chapters
// eval outputs (openai/gpt-5.2) to test with real upstream data.
// Chapters picked from different course levels (initial, mid-early, mid-late, final).
export const TEST_CASES = [
  {
    expectations: `
      - MUST be in US English

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
