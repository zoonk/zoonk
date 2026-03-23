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

TOPIC: Topic marker particle - enriching content about how it marks the topic of a sentence.

INPUT CONTEXT: The examples and exercises are about the Japanese topic marker particle, demonstrating its use in simple sentences.

ENRICHMENT CHECK:
- All translations, feedback, and explanations must be in English
- Discovery question must test understanding of topic marking, not vocabulary
- Rule summary must describe the pattern clearly for English speakers
- Exercise feedback must explain the grammar in English

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
          answers: ["は"],
          distractors: ["が", "を", "に"],
          template: "猫[BLANK]かわいいです。",
        },
        {
          answers: ["は"],
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

TOPIC: Present tense -ar verb conjugation - enriching content about regular verb endings.

INPUT CONTEXT: The examples and exercises demonstrate Spanish present tense conjugation of regular -ar verbs.

ENRICHMENT CHECK:
- All translations, feedback, and explanations must be in English
- Discovery question must test understanding of conjugation patterns, not vocabulary
- Rule summary must clearly describe the -ar conjugation paradigm
- Exercise feedback must explain why the correct conjugation is used

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
          answers: ["camino"],
          distractors: ["caminas", "camina", "caminamos"],
          template: "Yo [BLANK] al parque.",
        },
        {
          answers: ["estudian"],
          distractors: ["estudio", "estudias", "estudia"],
          template: "Ellos [BLANK] matematicas.",
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

TOPIC: Subject markers - enriching content about Korean subject marking particles.

INPUT CONTEXT: The examples and exercises demonstrate Korean subject markers, showing which marker to use based on consonant/vowel endings.

ENRICHMENT CHECK:
- All translations, feedback, and explanations must be in Portuguese
- Penalize SEVERELY if enrichment is in English instead of Portuguese
- Discovery question must test understanding of the consonant/vowel rule
- Rule summary must explain the pattern clearly for Portuguese speakers

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
          answers: ["가"],
          distractors: ["이", "을", "는"],
          template: "아이[BLANK] 놀아요.",
        },
        {
          answers: ["이"],
          distractors: ["가", "를", "은"],
          template: "음식[BLANK] 맛있어요.",
        },
      ],
      lessonDescription:
        "Los marcadores de sujeto coreanos y cómo elegir cuál usar según la palabra",
      lessonTitle: "Marcadores de Sujeto",
      targetLanguage: "ko",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
USER LANGUAGE: English
TARGET LANGUAGE: German

TOPIC: Verb-second (V2) word order - enriching content about German main clause structure.

INPUT CONTEXT: The examples and exercises demonstrate that the conjugated verb must occupy the second position in German declarative sentences.

ENRICHMENT CHECK:
- All translations, feedback, and explanations must be in English
- Discovery question must test understanding of V2 word order, not vocabulary
- Rule summary must clearly explain the V2 rule
- Exercise feedback must explain verb placement

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-v2-enrichment",
    userInput: {
      chapterTitle: "Sentence Structure",
      examples: [
        { highlight: "spiele", sentence: "Ich spiele Fussball." },
        { highlight: "spielt", sentence: "Heute spielt er Tennis." },
        { highlight: "liest", sentence: "Am Abend liest sie ein Buch." },
      ],
      exercises: [
        {
          answers: ["gehe"],
          distractors: ["ich gehe", "gehe ich", "gehen"],
          template: "Morgen [BLANK] ich ins Kino.",
        },
        {
          answers: ["trinkt"],
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

TOPIC: Adjective gender agreement - enriching content about French adjective-noun agreement.

INPUT CONTEXT: The examples and exercises demonstrate that French adjectives must agree in gender with the noun they modify.

ENRICHMENT CHECK:
- All translations, feedback, and explanations must be in Spanish
- Penalize SEVERELY if enrichment is in English or French instead of Spanish
- Discovery question must test understanding of gender agreement, not vocabulary
- Rule summary must describe the -e feminine pattern in Spanish

${SHARED_EXPECTATIONS}
    `,
    id: "es-french-gender-agreement-enrichment",
    userInput: {
      chapterTitle: "Adjetivos",
      examples: [
        { highlight: "grand", sentence: "Le garcon est grand." },
        { highlight: "grande", sentence: "La fille est grande." },
        { highlight: "petit", sentence: "Le chat est petit." },
        { highlight: "petite", sentence: "La maison est petite." },
      ],
      exercises: [
        {
          answers: ["intelligent"],
          distractors: ["intelligente", "intelligents", "intelligentes"],
          template: "Le professeur est [BLANK].",
        },
        {
          answers: ["contente"],
          distractors: ["content", "contents", "contentes"],
          template: "La femme est [BLANK].",
        },
      ],
      lessonDescription:
        "Como los adjetivos en francés se ajustan al género del sustantivo que modifican",
      lessonTitle: "Concordancia de Género",
      targetLanguage: "fr",
      userLanguage: "es",
    },
  },
];
