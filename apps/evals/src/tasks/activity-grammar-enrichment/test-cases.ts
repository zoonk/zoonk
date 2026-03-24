const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. USER-LANGUAGE OUTPUT (CRITICAL - highest priority):
   - ALL enrichment content MUST be in the USER language
   - Translations, discovery question, rule summary, and feedback must be in the user's language
   - Penalize SEVERELY if enrichment content is in the target language instead of the user language

2. EXAMPLE TRANSLATIONS:
   - Must provide one translation per example in the same order
   - Translations must be accurate and natural in the user language
   - Number of translations must match number of examples provided
   - Penalize if translations are inaccurate or missing

3. DISCOVERY QUESTION:
   - Must include a question testing pattern recognition, NOT memorization
   - Must have exactly 4 options
   - Must have exactly 1 correct option (isCorrect: true)
   - ALL options must have feedback explaining why they are correct/incorrect
   - Distractors should be plausible observations a learner might make
   - Penalize if the question tests vocabulary instead of grammar understanding

4. RULE NAME AND SUMMARY:
   - Rule name should clearly identify the grammar pattern
   - Rule summary must be maximum 2 sentences
   - Must confirm what was discoverable from the examples
   - Must use clear, simple language in the user's language
   - Penalize if verbose, unclear, or introduces new concepts

5. EXERCISE ENRICHMENT:
   - exerciseFeedback: one feedback string per exercise explaining the correct answer
   - exerciseQuestions: one question per exercise (can be null)
   - exerciseTranslations: one translation per exercise template
   - Array lengths must match the number of exercises provided
   - Penalize if feedback doesn't explain why the correct answer fits the pattern

6. LINGUISTIC ACCURACY (CRITICAL):
   - All translations must be accurate
   - Grammar explanations must be correct
   - Feedback must be pedagogically sound
   - Penalize SEVERELY for mistranslations or incorrect grammar explanations

VALID TRANSLATION CHOICES (do NOT penalize for these):
- Present tense vs present progressive when both are valid translations of the source tense (e.g., German/Korean present tense → English "I go" or "I'm going" are both correct)
- Regional vocabulary preferences (e.g., "math" vs "mathematics", "movies" vs "cinema")
- Natural idiomatic phrasing that preserves meaning without mirroring source structure word-for-word

VALID EXPLANATION CHOICES (do NOT penalize for these):
- Rule summaries using full conjugated forms (hablo, hablas) vs isolated endings (-o, -as) — both are accurate descriptions
- General descriptions ("depends on how the word ends") vs specific descriptions ("consonant vs vowel") — both are valid if accurate
- Different but correct grammatical terminology for the same concept

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific phrasing - accept ANY valid translations and explanations
- Do NOT require specific vocabulary in explanations
- FOCUS ON: user-language correctness, translation accuracy, pedagogical quality, structural completeness
`;

export const TEST_CASES = [
  {
    expectations: `
USER LANGUAGE: English
TARGET LANGUAGE: Japanese
TOPIC: Topic marker particle (は) — how it marks the topic of a sentence

TOPIC-SPECIFIC CHECKS:
- Discovery question should target topic-marking function, not vocabulary knowledge
- Rule summary should describe what は does in the given sentences

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-topic-marker-enrichment",
    userInput: {
      chapterTitle: "Basic Particles",
      examples: [
        { highlight: "は", sentence: "私は学生です。" },
        { highlight: "は", sentence: "田中さんは先生です。" },
        { highlight: "は", sentence: "東京は大きいです。" },
      ],
      exercises: [
        {
          answer: "は",
          distractors: ["が", "を", "に"],
          template: "猫[BLANK]かわいいです。",
        },
        {
          answer: "は",
          distractors: ["が", "を", "で"],
          template: "私[BLANK]日本人です。",
        },
      ],
      lessonDescription:
        "The topic marker particle and how it indicates what the sentence is about",
      lessonTitle: "Topic Marker",
      targetLanguage: "ja",
      userLanguage: "en",
    },
  },
  {
    expectations: `
USER LANGUAGE: English
TARGET LANGUAGE: Spanish
TOPIC: Present tense -ar verb conjugation — regular verb endings that change based on the subject

TOPIC-SPECIFIC CHECKS:
- Discovery question should target conjugation patterns (how endings change), not vocabulary
- Rule summary should describe the -ar verb pattern shown in the examples

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-ar-verb-enrichment",
    userInput: {
      chapterTitle: "Present Tense Verbs",
      examples: [
        { highlight: "hablo", sentence: "Yo hablo español." },
        { highlight: "hablas", sentence: "Tú hablas inglés." },
        { highlight: "habla", sentence: "Ella habla francés." },
        { highlight: "hablamos", sentence: "Nosotros hablamos italiano." },
      ],
      exercises: [
        {
          answer: "camino",
          distractors: ["caminas", "camina", "caminamos"],
          template: "Yo [BLANK] al parque.",
        },
        {
          answer: "estudian",
          distractors: ["estudio", "estudias", "estudia"],
          template: "Ellos [BLANK] matemáticas.",
        },
      ],
      lessonDescription:
        "How to conjugate regular -ar verbs in the present tense, matching verb endings to subjects",
      lessonTitle: "Regular -ar Verbs",
      targetLanguage: "es",
      userLanguage: "en",
    },
  },
  {
    expectations: `
USER LANGUAGE: Brazilian Portuguese
TARGET LANGUAGE: Korean
TOPIC: Subject markers (이/가) — particles whose form depends on whether the preceding word ends in a consonant or vowel

TOPIC-SPECIFIC CHECKS:
- Discovery question should target the consonant/vowel alternation pattern
- Rule summary should explain which marker appears in which phonological context

${SHARED_EXPECTATIONS}
    `,
    id: "pt-korean-subject-marker-enrichment",
    userInput: {
      chapterTitle: "Partículas Básicas",
      examples: [
        { highlight: "이", sentence: "학생이 공부해요." },
        { highlight: "가", sentence: "고양이가 자요." },
        { highlight: "이", sentence: "선생님이 가르쳐요." },
      ],
      exercises: [
        {
          answer: "가",
          distractors: ["이", "을", "는"],
          template: "아이[BLANK] 놀아요.",
        },
        {
          answer: "이",
          distractors: ["가", "를", "은"],
          template: "음식[BLANK] 맛있어요.",
        },
      ],
      lessonDescription:
        "Os marcadores de sujeito coreanos e como escolher qual usar de acordo com a palavra",
      lessonTitle: "Marcadores de Sujeito",
      targetLanguage: "ko",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
USER LANGUAGE: English
TARGET LANGUAGE: German
TOPIC: Verb-second (V2) word order — the conjugated verb must occupy the second position in German main clauses

TOPIC-SPECIFIC CHECKS:
- Discovery question should target verb placement, not vocabulary
- Rule summary should explain the V2 word order rule
- Exercise feedback should explain why the verb goes in second position

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-v2-enrichment",
    userInput: {
      chapterTitle: "Sentence Structure",
      examples: [
        { highlight: "spiele", sentence: "Ich spiele Fußball." },
        { highlight: "spielt", sentence: "Heute spielt er Tennis." },
        { highlight: "liest", sentence: "Am Abend liest sie ein Buch." },
      ],
      exercises: [
        {
          answer: "gehe",
          distractors: ["ich gehe", "gehe ich", "gehen"],
          template: "Morgen [BLANK] ich ins Kino.",
        },
        {
          answer: "trinkt",
          distractors: ["er trinkt", "trinkt er", "trinken"],
          template: "Am Morgen [BLANK] er Kaffee.",
        },
      ],
      lessonDescription:
        "Understanding German verb-second word order in main clauses and how it differs from English",
      lessonTitle: "Verb Second Word Order",
      targetLanguage: "de",
      userLanguage: "en",
    },
  },
  {
    expectations: `
USER LANGUAGE: Spanish (Latin American)
TARGET LANGUAGE: French
TOPIC: Adjective gender agreement — French adjectives change form to agree with the noun's gender

TOPIC-SPECIFIC CHECKS:
- Discovery question should target gender agreement patterns, not vocabulary
- Rule summary should describe the masculine/feminine adjective pattern shown in the examples

${SHARED_EXPECTATIONS}
    `,
    id: "es-french-gender-agreement-enrichment",
    userInput: {
      chapterTitle: "Adjetivos",
      examples: [
        { highlight: "grand", sentence: "Le garçon est grand." },
        { highlight: "grande", sentence: "La fille est grande." },
        { highlight: "petit", sentence: "Le chat est petit." },
        { highlight: "petite", sentence: "La maison est petite." },
      ],
      exercises: [
        {
          answer: "intelligent",
          distractors: ["intelligente", "intelligents", "intelligentes"],
          template: "Le professeur est [BLANK].",
        },
        {
          answer: "contente",
          distractors: ["content", "contents", "contentes"],
          template: "La femme est [BLANK].",
        },
      ],
      lessonDescription:
        "Cómo los adjetivos en francés se ajustan al género del sustantivo que modifican",
      lessonTitle: "Concordancia de Género",
      targetLanguage: "fr",
      userLanguage: "es",
    },
  },
];
