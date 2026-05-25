const SHARED_EXPECTATIONS = `
  # How to evaluate

  You are evaluating a LANGUAGE CURRICULUM. Think like a language curriculum designer reviewing a colleague's work — use expertise in second language acquisition and professional judgment, not mechanical rule-checking.

  ## Structure

  Output is a flat list of playable LESSONS.
  - Each lesson should be one teachable unit appropriate to the chapter's level and topic
  - Lesson count should vary naturally with the chapter scope
  - Total lesson coverage should be exhaustive for the chapter's scope

  ## Evaluating lesson quality

  Ask: "Is this ONE playable lesson, or is it secretly a bundle of separate lessons?"
  - A lesson is too broad only if it genuinely bundles multiple DISTINCT items that a student would need separate practice for
  - Use domain expertise: conventions that look like rule violations to a generalist may be standard practice in language teaching. Grammar notation, comparison pairs, and target-language labels are all normal in language curricula
  - Comparisons and contrasts are natural in language learning — a synonym pair or a form distinction IS a single lesson when the contrast itself is what the learner needs to master
  - Watch for false granularity: the same form repeated across different subjects or contexts is NOT multiple lessons
  - Watch for factual accuracy: grammar rules, conjugation forms, and usage patterns must be linguistically correct for the target language
  - Every lesson must be anchored in specific target-language items the learner will produce or recognize. Abstract category labels are acceptable only when the description names the concrete language items

  ## Evaluating scope

  The chapter description is the SOURCE OF TRUTH.
  - Lessons must serve language acquisition — no culture, career, exam prep, or literature content
  - The curriculum should stay at the chapter's level — an advanced chapter should not include basic content that belongs in earlier chapters
  - In a language course, content naturally mixes the user's language and the target language — this is expected, not a language violation

  ## Evaluating alphabet lesson scope

  Alphabet lessons produce symbol cards and recognition checks, so broad script lessons become unplayably long.
  - For non-Roman writing-system chapters, broad script coverage should be split into several alphabet lessons
  - Each alphabet lesson should name one natural writing-system chunk: a row/family, mark family, positional-form pattern, block-composition pattern, or small contrast set
  - Do not accept a single alphabet lesson that covers a whole alphabet, syllabary, abjad, abugida, or writing system
  - Do not require a fixed symbol count; judge whether the title and description define a playable closed chunk
  - For chapters that are not about writing systems, avoid alphabet lessons unless script recognition is explicitly part of the chapter scope

  ## Evaluating copy and progression

  - Lesson descriptions should be concise — no filler words like "introduces", "presents", "teaches"
  - Lesson descriptions should use direct learner-facing wording, not third-person or future boilerplate such as "O aluno vai...", "The learner will...", or "El estudiante va a..."
  - Prefer direct action phrasing such as "Reconheça...", "Use...", "Compare...", "Choose...", or the natural equivalent in the user's language
  - Logical progression from foundational to advanced
  - No summary, review, or assessment lessons
  - No duplicate lesson scope across lessons

  ## Coverage

  Completeness is the key metric. Are all topics in the chapter description covered with sufficient granularity and playable lesson scope?

  ## How to score

  Start by asking: "Would this curriculum actually teach the chapter effectively?" Then look for issues.

  A curriculum that would genuinely teach the chapter well but has some title-phrasing imperfections deserves a high score. A curriculum that looks structurally clean but wouldn't actually help a learner (e.g., abstract categories instead of practicable items, factual errors in grammar) deserves a low score.

  When something looks like a rule violation but makes pedagogical sense in context, favor the pedagogical judgment. The rules exist to produce good curricula — if the curriculum is good despite a technical rule bend, that matters more than the rule.
`;

// Chapter titles and descriptions sourced from language-course-chapters
// eval outputs to test with real upstream data.
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
      USER LANGUAGE: Brazilian Portuguese
      TARGET LANGUAGE: English

      Lesson descriptions should be direct and concise. A description like "Reconheça e use cumprimentos comuns como hello, hi, good morning e good evening" is better than "O aluno vai reconhecer e usar cumprimentos...". Repeated "O aluno vai..." phrasing is a copy issue even when the lesson scope is correct.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-english-greetings-direct-descriptions",
    userInput: {
      chapterDescription:
        "Cumprimentos, despedidas, apresentações simples, perguntas sobre nome e origem, e expressões básicas de cortesia.",
      chapterTitle: "Saudações e Apresentações",
      targetLanguage: "en",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
      USER LANGUAGE: Brazilian Portuguese
      TARGET LANGUAGE: Japanese

      This is a writing-system chapter. A single broad alphabet lesson such as "Hiragana", "Hiragana básico", or "Tabela hiragana" is a major issue because it would produce too many player steps. The plan should split hiragana into multiple precise alphabet lessons whose titles/descriptions name the chunk being learned, such as natural rows, symbol families, marks, or small-kana combinations. The exact split can vary, but the output should make the full chapter playable without dumping the whole syllabary into one lesson.

      ${SHARED_EXPECTATIONS}
    `,
    id: "pt-japanese-hiragana-playable-chunks",
    userInput: {
      chapterDescription:
        "Hiragana para iniciantes: vogais, linhas consonantais principais, ん, dakuten, handakuten e combinações yōon iniciais.",
      chapterTitle: "Hiragana",
      targetLanguage: "ja",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
      USER LANGUAGE: English
      TARGET LANGUAGE: Korean

      This is a writing-system chapter. The plan should not create one broad alphabet lesson for all of Hangul. It should split script learning into several playable alphabet lessons, separating natural chunks such as basic vowels/consonants, syllable-block mechanics, final consonant recognition, and common contrast sets when they are in scope. A broad "Hangul basics" alphabet lesson that tries to cover the whole writing system is a major issue.

      ${SHARED_EXPECTATIONS}
    `,
    id: "en-korean-hangul-playable-chunks",
    userInput: {
      chapterDescription:
        "Beginner Hangul: basic vowels and consonants, how letters combine into syllable blocks, initial and final consonant positions, and common visual contrasts.",
      chapterTitle: "Hangul Foundations",
      targetLanguage: "ko",
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
