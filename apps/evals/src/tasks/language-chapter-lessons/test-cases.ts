const SHARED_EXPECTATIONS = `
  # How to evaluate

  You are evaluating a LANGUAGE CURRICULUM. Think like a language curriculum designer reviewing a colleague's work — use expertise in second language acquisition and professional judgment, not mechanical rule-checking.

  ## Structure

  Output is organized into LESSON UNITS (thematic groups) containing CONCEPTS (individual teachable items).
  - Each concept should be a single teachable unit appropriate to the chapter's level and topic
  - Lesson sizes should be 3-8 concepts and should vary naturally across lessons
  - Total concept coverage should be exhaustive for the chapter's scope

  ## Evaluating concept quality

  Ask: "Is this ONE teachable thing, or is it secretly a bundle of separate things?"
  - A concept is too broad only if it genuinely bundles multiple DISTINCT items that a student would need separate practice for
  - Use domain expertise: conventions that look like rule violations to a generalist may be standard practice in language teaching. Grammar notation, comparison pairs, and target-language labels are all normal in language curricula
  - Comparisons and contrasts are natural in language learning — a synonym pair or a form distinction IS a single concept when the contrast itself is what the learner needs to master
  - Watch for false granularity: the same form repeated across different subjects or contexts is NOT multiple concepts
  - Watch for factual accuracy: grammar rules, conjugation forms, and usage patterns must be linguistically correct for the target language
  - Every concept must be anchored in specific target-language items the learner will produce or recognize. Abstract category labels are acceptable as lesson titles but not as individual concepts

  ## Evaluating scope

  The chapter description is the SOURCE OF TRUTH.
  - Concepts must serve language acquisition — no culture, career, exam prep, or literature content
  - The curriculum should stay at the chapter's level — an advanced chapter should not include basic content that belongs in earlier chapters
  - In a language course, content naturally mixes the user's language and the target language — this is expected, not a language violation

  ## Evaluating lesson quality

  - Lesson descriptions should be concise — no filler words like "introduces", "presents", "teaches"
  - Logical progression from foundational to advanced
  - No summary, review, or assessment lessons
  - No duplicate concepts across lessons

  ## Coverage

  Completeness is the key metric. Are all topics in the chapter description covered with sufficient granularity?

  ## How to score

  Start by asking: "Would this curriculum actually teach the chapter effectively?" Then look for issues.

  A curriculum that would genuinely teach the chapter well but has some title-phrasing imperfections deserves a high score. A curriculum that looks structurally clean but wouldn't actually help a learner (e.g., abstract categories instead of practicable items, factual errors in grammar) deserves a low score.

  When something looks like a rule violation but makes pedagogical sense in context, favor the pedagogical judgment. The rules exist to produce good curricula — if the curriculum is good despite a technical rule bend, that matters more than the rule.
`;

// Chapter titles and descriptions sourced from language-course-chapters
// eval outputs (openai/gpt-5.2) to test with real upstream data.
// Chapters picked from different course levels (initial, mid-early, mid-late, final).
export const TEST_CASES = [
  {
    expectations: `
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
