const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. TRANSLATION ACCURACY (CRITICAL - highest priority):
   - Each translation MUST convey the full meaning of its target-language sentence
   - Preserve tone and register while using natural phrasing in USER_LANGUAGE
   - Consider regional variations (Brazilian Portuguese vs European, Latin American Spanish vs Castilian)
   - Penalize SEVERELY if translations are incorrect, incomplete, misleading, or unnatural

2. LESSON SCOPE USAGE (CRITICAL):
   - Each generated sentence MUST fit the lesson title, description, and source lesson metadata
   - Important words and phrases implied by the lesson scope should be used in their natural form (conjugated verbs, declined nouns are acceptable)
   - Penalize SEVERELY if sentences drift away from the lesson scope
   - Penalize if lesson-scope words or phrases are used incorrectly or out of context

3. GRAMMATICAL CORRECTNESS:
   - Sentences must be grammatically correct in the target language
   - Verb conjugations must match the subject
   - Gender agreement must be correct where applicable
   - Word order should follow natural patterns of the target language
   - Penalize for grammar errors, incorrect conjugations, or unnatural constructions

4. SENTENCE NATURALNESS:
   - Sentences should sound natural to native speakers
   - Use appropriate register (formal/informal) for the context
   - Penalize artificial, contrived, robotic, or textbook-like constructions

5. CONTEXT DIVERSITY:
   - Sentences should present different contexts or situations
   - Avoid repetitive sentence structures
   - Use variety in sentence types (statements, questions, commands where appropriate)
   - Do NOT penalize for covering similar themes if the lesson scope naturally groups those situations together

6. APPROPRIATE DIFFICULTY (CRITICAL):
   - The model MUST infer difficulty from the chapter title, lesson title, lesson description, and source scope
   - Beginner context (basic topics + simple source scope) → simple sentences (2-5 words)
   - Intermediate context → medium sentences (4-8 words)
   - Advanced context (complex topics + advanced vocabulary) → complex sentences allowed
   - Penalize SEVERELY if beginner-level context produces complex sentences (compound sentences, subordinate clauses, long constructions)
   - Penalize if advanced-level context produces only trivially simple sentences

7. NO DUPLICATES:
   - Each sentence should be unique
   - Avoid near-duplicates (same sentence with minor word changes)
   - Avoid semantic duplicates that express the same idea with superficial wording changes

8. LANGUAGE SEPARATION (CRITICAL):
   - Every sentence MUST be written entirely in TARGET_LANGUAGE
   - Translations and explanations MUST be written in USER_LANGUAGE
   - Penalize if languages are swapped or if USER_LANGUAGE words appear in a target-language sentence

9. EXPLANATION QUALITY (required for every sentence):
   - Each explanation MUST be a non-empty string in USER_LANGUAGE; null or empty explanations are invalid
   - Explain why this specific sentence is structured this way in TARGET_LANGUAGE and how it differs from USER_LANGUAGE
   - Focus on useful contrasts such as word order, grammar, word choice, false friends, or potentially confusing forms
   - Grammar claims MUST describe the element's actual role in this sentence
   - For non-Latin target scripts, every target-language word or phrase mentioned in the explanation MUST be immediately followed by its romanization in parentheses
   - Do NOT expect a separate romanization field; the task does not generate one

10. CLEAN OUTPUT FIELDS:
    - The sentence and translation fields MUST contain only their respective text, with no parenthetical explanations, usage notes, grammar hints, or alternative phrasings
    - Sentences and translations should avoid decorative terminal punctuation because they become word-bank tiles
    - Penalize unnecessary punctuation on simple greetings, farewells, thanks, statements, labels, or short conversational chunks (e.g., "Good morning!" should be "Good morning"; "See you later." should be "See you later")
    - Do NOT penalize punctuation that changes meaning or is grammatically required, especially question marks for questions (e.g., "How are you?") and required target-language question punctuation (e.g., "¿Cómo estás?")

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific sentence choices - accept ANY valid sentences that fit the lesson scope
- Do NOT penalize for not including specific contexts you might expect
- Do NOT require a specific number of sentences
- Do NOT expect sentences to follow any particular template or pattern
- Different valid sentence constructions exist - assess the quality of what IS provided
- FOCUS ON: translation accuracy, lesson-scope usage, grammatical correctness, naturalness, explanation quality, and difficulty appropriateness
`;

/**
 * Sentence evals should use the same contract as production reading
 * generation: planned lesson metadata defines scope, not generated vocabulary
 * output from another workflow.
 */
function sourceLessonMetadata({ description, title }: { description: string; title: string }) {
  return [{ description, title }];
}

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Spanish sentences for greetings and introductions - using basic greeting vocabulary.

SOURCE LESSON METADATA: basic greeting phrases such as hola, buenos días, buenas noches, adiós, gracias.
Generated sentences should naturally cover this source scope.

DIFFICULTY: This is clearly a BEGINNER-level lesson. Chapter "Basic Greetings and Introductions" + Lesson "Greetings and Introductions" + simple greeting vocabulary = absolute beginner.
- Sentences MUST be very simple (2-5 words max)
- No compound sentences, no subordinate clauses
- Examples of acceptable complexity: "Hola", "Buenos días, María", "Gracias"
- Examples of UNACCEPTABLE complexity: "As she entered the coffee shop, she immediately said good afternoon"
- Penalize SEVERELY if any sentence has more than 5-6 words or uses complex structures
- Penalize unnecessary exclamation marks or periods on greeting chunks; keep question marks only for actual questions

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Greetings are used incorrectly (e.g., "buenas noches" used for morning)
- Translations don't match the Spanish sentences

CONTEXT EXPECTATIONS:
- Sentences should demonstrate natural use of greetings
- Various social situations (meeting someone, saying goodbye, thanking)
- Different times of day where appropriate

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-greetings",
    userInput: {
      chapterTitle: "Basic Greetings and Introductions",
      lessonDescription:
        "Learn the most common Spanish greetings and how to introduce yourself in everyday situations.",
      lessonTitle: "Greetings and Introductions",
      sourceLessons: sourceLessonMetadata({
        description:
          "Basic greeting and introduction phrases such as hola, buenos días, buenas noches, adiós, and gracias.",
        title: "Greeting Vocabulary",
      }),
      targetLanguage: "es",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: French sentences for food and dining - using food-related vocabulary.

SOURCE LESSON METADATA: food and dining nouns such as le pain, le fromage, le vin, la soupe, le dessert.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner-to-intermediate level. Chapter "Food and Meals" + common food nouns = beginner vocabulary, but dining contexts allow slightly longer sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Food items are used in unrealistic contexts
- Gender agreement is incorrect (le/la must match the noun)
- Translations don't accurately convey the French meaning

CONTEXT EXPECTATIONS:
- Sentences about ordering, eating, or discussing food
- Restaurant or home dining situations
- Natural food-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-french-food",
    userInput: {
      chapterTitle: "Food and Meals",
      lessonDescription: "Learn to name common foods and order at a restaurant.",
      lessonTitle: "Food and Dining",
      sourceLessons: sourceLessonMetadata({
        description:
          "Common food and dining nouns such as le pain, le fromage, le vin, la soupe, and le dessert.",
        title: "Food Vocabulary",
      }),
      targetLanguage: "fr",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: German sentences for family members - using family vocabulary.

SOURCE LESSON METADATA: family nouns such as die Mutter, der Vater, die Schwester, der Bruder, die Familie.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "Family and Relationships" + basic family nouns = foundational vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Case endings are incorrect (nominative, accusative, dative contexts)
- Article-noun agreement is wrong
- Translations don't accurately convey the German meaning

CONTEXT EXPECTATIONS:
- Sentences about family relationships and everyday situations
- Talking about or introducing family members
- Family-related situations and conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-family",
    userInput: {
      chapterTitle: "Family and Relationships",
      lessonDescription: "Learn to talk about your family members in German.",
      lessonTitle: "Family Members",
      sourceLessons: sourceLessonMetadata({
        description:
          "Basic family nouns such as die Mutter, der Vater, die Schwester, der Bruder, and die Familie.",
        title: "Family Vocabulary",
      }),
      targetLanguage: "de",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Japanese sentences for numbers and counting - using basic number vocabulary.

SOURCE LESSON METADATA: basic number kanji such as 一, 二, 三, 五, 十.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "Numbers and Basics" + basic number kanji = foundational vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Counter words are used incorrectly
- Japanese number readings are wrong in context
- Translations don't match the Japanese sentences

CONTEXT EXPECTATIONS:
- Sentences using numbers in practical contexts (counting, telling age, quantities)
- Natural use of Japanese counters where appropriate
- Various everyday situations involving numbers

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-numbers",
    userInput: {
      chapterTitle: "Numbers and Basics",
      lessonDescription: "Learn to count and use numbers in everyday Japanese.",
      lessonTitle: "Numbers and Counting",
      sourceLessons: sourceLessonMetadata({
        description: "Basic number kanji and counting contexts such as 一, 二, 三, 五, and 十.",
        title: "Number Vocabulary",
      }),
      targetLanguage: "ja",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Korean sentences for colors - using basic color vocabulary.

SOURCE LESSON METADATA: basic color words such as 빨간색, 파란색, 노란색, 초록색, 검은색.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "Colors and Descriptions" + basic color words = foundational vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Color words are used grammatically incorrectly
- Translations don't match the Korean sentences

CONTEXT EXPECTATIONS:
- Sentences describing objects by color
- Shopping or everyday situations involving colors
- Natural Korean sentence structures

${SHARED_EXPECTATIONS}
    `,
    id: "en-korean-colors",
    userInput: {
      chapterTitle: "Colors and Descriptions",
      lessonDescription: "Learn the basic color words in Korean and how to describe objects.",
      lessonTitle: "Colors",
      sourceLessons: sourceLessonMetadata({
        description:
          "Basic color words and object descriptions such as 빨간색, 파란색, 노란색, 초록색, and 검은색.",
        title: "Color Vocabulary",
      }),
      targetLanguage: "ko",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: Italian sentences for travel and transportation - using travel vocabulary.

SOURCE LESSON METADATA: travel and transportation vocabulary such as il treno, l'aereo, la macchina, il biglietto, la stazione.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Intermediate level. Chapter "Getting Around" + travel/transport vocabulary = practical intermediate topic.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Article contractions are incorrect (e.g., l'aereo not la aereo)
- Translations are in English instead of Portuguese
- Gender agreement is incorrect

CONTEXT EXPECTATIONS:
- Sentences about traveling, booking tickets, transportation
- Natural travel-related conversations
- Various modes of transportation

${SHARED_EXPECTATIONS}
    `,
    id: "pt-italian-travel",
    userInput: {
      chapterTitle: "Getting Around",
      lessonDescription:
        "Learn vocabulary for transportation and traveling in Italian-speaking countries.",
      lessonTitle: "Viagens e Transporte",
      sourceLessons: sourceLessonMetadata({
        description:
          "Travel and transportation vocabulary such as il treno, l'aereo, la macchina, il biglietto, and la stazione.",
        title: "Transportation Vocabulary",
      }),
      targetLanguage: "it",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: Spanish sentences for shopping - using shopping vocabulary.

SOURCE LESSON METADATA: shopping and price vocabulary such as comprar, la tienda, el precio, caro, barato.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Intermediate level. Chapter "Shopping and Commerce" + verbs and adjectives = intermediate vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Verb conjugation is incorrect (comprar conjugated forms)
- Adjective gender agreement is wrong (caro/cara, barato/barata)
- Translations are in English instead of Portuguese

CONTEXT EXPECTATIONS:
- Sentences about buying, prices, stores
- Shopping conversations and situations
- Natural commercial interactions

${SHARED_EXPECTATIONS}
    `,
    id: "pt-spanish-shopping",
    userInput: {
      chapterTitle: "Shopping and Commerce",
      lessonDescription: "Learn to talk about prices, compare costs, and shop in Spanish.",
      lessonTitle: "Compras",
      sourceLessons: sourceLessonMetadata({
        description:
          "Shopping and price vocabulary such as comprar, la tienda, el precio, caro, and barato.",
        title: "Shopping Vocabulary",
      }),
      targetLanguage: "es",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required for translations (NOT English).

TOPIC: French sentences for weather - using weather vocabulary.

SOURCE LESSON METADATA: weather nouns and expressions such as le soleil, la pluie, le vent, il fait chaud, il fait froid.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Intermediate level. Chapter "Weather and Seasons" + weather expressions (including impersonal "il fait" constructions) = intermediate.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Weather expressions are used incorrectly
- Translations are in English instead of Spanish

CONTEXT EXPECTATIONS:
- Sentences describing weather conditions
- Planning activities based on weather
- Natural weather-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "es-french-weather",
    userInput: {
      chapterTitle: "Weather and Seasons",
      lessonDescription: "Learn to describe the weather and talk about seasonal lessons in French.",
      lessonTitle: "El Clima",
      sourceLessons: sourceLessonMetadata({
        description:
          "Weather nouns and expressions such as le soleil, la pluie, le vent, il fait chaud, and il fait froid.",
        title: "Weather Vocabulary",
      }),
      targetLanguage: "fr",
      userLanguage: "es",
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required for translations (NOT English).

TOPIC: Japanese sentences for time expressions - using time-related vocabulary.

SOURCE LESSON METADATA: basic time expressions such as 今日, 明日, 昨日, 朝, 夜.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner-to-intermediate level. Chapter "Time and Daily Life" + basic time words = foundational vocabulary but with context for short sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Time expressions are used incorrectly in context
- Translations are in English instead of Spanish

CONTEXT EXPECTATIONS:
- Sentences about daily routines and schedules
- References to different times of day
- Natural Japanese time expressions

${SHARED_EXPECTATIONS}
    `,
    id: "es-japanese-time",
    userInput: {
      chapterTitle: "Time and Daily Life",
      lessonDescription:
        "Learn basic time expressions to talk about your daily schedule in Japanese.",
      lessonTitle: "Expresiones de Tiempo",
      sourceLessons: sourceLessonMetadata({
        description:
          "Basic time expressions for daily schedules such as 今日, 明日, 昨日, 朝, and 夜.",
        title: "Time Vocabulary",
      }),
      targetLanguage: "ja",
      userLanguage: "es",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Mandarin Chinese sentences for common verbs - using action verbs.

SOURCE LESSON METADATA: common action verbs such as 吃, 喝, 看, 听, 说.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "Essential Verbs" + basic action verbs = foundational vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Chinese word order is incorrect
- Aspect markers are used incorrectly (了, 着, 过)
- Translations don't match the Chinese sentences

CONTEXT EXPECTATIONS:
- Sentences demonstrating various uses of these common verbs
- Daily life activities (eating, drinking, watching, listening, speaking)
- Natural Chinese sentence structures

${SHARED_EXPECTATIONS}
    `,
    id: "en-chinese-verbs",
    userInput: {
      chapterTitle: "Essential Verbs",
      lessonDescription: "Learn the most common action verbs used in daily Mandarin Chinese.",
      lessonTitle: "Common Verbs",
      sourceLessons: sourceLessonMetadata({
        description: "Common action verbs for daily life such as 吃, 喝, 看, 听, and 说.",
        title: "Action Verb Vocabulary",
      }),
      targetLanguage: "zh",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Russian sentences for places in the city - using location vocabulary.

SOURCE LESSON METADATA: common city places such as магазин, ресторан, парк, школа, библиотека.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner-to-intermediate level. Chapter "Around Town" + common location nouns = practical vocabulary that requires preposition usage.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Case endings are incorrect (prepositional for location, accusative for direction)
- Preposition usage is wrong (в/на)
- Translations don't match the Russian sentences

CONTEXT EXPECTATIONS:
- Sentences about going to places, being at places
- Giving and asking directions
- Natural urban/location-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-russian-places",
    userInput: {
      chapterTitle: "Around Town",
      lessonDescription: "Learn to name and navigate common places in your city in Russian.",
      lessonTitle: "Places in the City",
      sourceLessons: sourceLessonMetadata({
        description:
          "Common city places and navigation contexts such as магазин, ресторан, парк, школа, and библиотека.",
        title: "City Place Vocabulary",
      }),
      targetLanguage: "ru",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Arabic sentences for common adjectives - using descriptive vocabulary.

SOURCE LESSON METADATA: common descriptive adjectives such as كبير, صغير, جميل, جديد, قديم.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner-to-intermediate level. Chapter "Describing Things" + basic adjectives = foundational vocabulary, but Arabic adjective agreement requires some complexity.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Adjective-noun agreement is incorrect (gender, number)
- Word order is unnatural
- Translations don't match the Arabic sentences

CONTEXT EXPECTATIONS:
- Sentences describing objects, people, or places
- Comparative contexts where natural
- Natural Arabic descriptive constructions

${SHARED_EXPECTATIONS}
    `,
    id: "en-arabic-adjectives",
    userInput: {
      chapterTitle: "Describing Things",
      lessonDescription:
        "Learn common adjectives to describe objects, people, and places in Arabic.",
      lessonTitle: "Common Adjectives",
      sourceLessons: sourceLessonMetadata({
        description:
          "Basic descriptive adjectives such as كبير, صغير, جميل, جديد, and قديم in object and place descriptions.",
        title: "Descriptive Vocabulary",
      }),
      targetLanguage: "ar",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Portuguese sentences for emotions and feelings - using emotion vocabulary.

SOURCE LESSON METADATA: emotion and physical-state expressions such as feliz, triste, cansado, com fome, com sede.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "How Are You Feeling?" + basic emotion/state vocabulary = foundational topic.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Estar vs ser usage is incorrect for states (estar feliz, not ser feliz for temporary states)
- Gender agreement is wrong (cansado/cansada)
- Translations don't match the Portuguese sentences

CONTEXT EXPECTATIONS:
- Sentences expressing how someone feels
- Various situations causing different emotions
- Natural emotional expressions in Portuguese

${SHARED_EXPECTATIONS}
    `,
    id: "en-portuguese-emotions",
    userInput: {
      chapterTitle: "How Are You Feeling?",
      lessonDescription: "Learn to express emotions and physical states in Brazilian Portuguese.",
      lessonTitle: "Emotions and Feelings",
      sourceLessons: sourceLessonMetadata({
        description:
          "Emotion and physical-state expressions such as feliz, triste, cansado, com fome, and com sede.",
        title: "Emotion Vocabulary",
      }),
      targetLanguage: "pt",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: German sentences for daily routines - using routine action vocabulary.

SOURCE LESSON METADATA: daily routine verbs such as aufstehen, frühstücken, arbeiten, schlafen, essen.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Intermediate level. Chapter "Daily Routines" + separable prefix verbs and verb conjugation = intermediate grammar required.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Separable prefix verbs are handled incorrectly (aufstehen -> ich stehe auf)
- Verb conjugation is wrong
- Translations are in English instead of Portuguese

CONTEXT EXPECTATIONS:
- Sentences about daily routines and schedules
- Morning, work, and evening routines
- Natural German verb usage in context

${SHARED_EXPECTATIONS}
    `,
    id: "pt-german-routines",
    userInput: {
      chapterTitle: "Daily Routines",
      lessonDescription: "Learn to describe your daily routine using common German verbs.",
      lessonTitle: "Rotinas Diárias",
      sourceLessons: sourceLessonMetadata({
        description:
          "Daily routine verbs such as aufstehen, frühstücken, arbeiten, schlafen, and essen.",
        title: "Daily Routine Vocabulary",
      }),
      targetLanguage: "de",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Thai sentences for polite expressions - using politeness vocabulary.

SOURCE LESSON METADATA: essential polite expressions such as ขอบคุณ, ขอโทษ, ได้โปรด, สวัสดี, ลาก่อน.
Generated sentences should naturally cover this source scope.

DIFFICULTY: Beginner level. Chapter "Basic Politeness" + common polite expressions = foundational vocabulary.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Politeness particles are missing where required (ครับ/คะ)
- Translations don't match the Thai sentences

VOCABULARY NATURALNESS NOTE:
- ได้โปรด is inherently formal/pleading in Thai. Since it is part of the source scope, accept it in various polite request contexts (asking for help, directions, favors, etc.)
- Only penalize ได้โปรด usage if it appears in completely inappropriate situations (e.g., casual greetings between friends)
- Prefer contexts where the formality of ได้โปรด fits naturally (urgent requests, formal situations, asking strangers for help)

CONTEXT EXPECTATIONS:
- Sentences demonstrating polite interactions
- Social situations requiring courtesy
- Natural Thai politeness conventions

${SHARED_EXPECTATIONS}
    `,
    id: "en-thai-politeness",
    userInput: {
      chapterTitle: "Basic Politeness",
      lessonDescription: "Learn essential polite expressions for everyday interactions in Thai.",
      lessonTitle: "Polite Expressions",
      sourceLessons: sourceLessonMetadata({
        description: "Essential polite expressions such as ขอบคุณ, ขอโทษ, ได้โปรด, สวัสดี, and ลาก่อน.",
        title: "Polite Expression Vocabulary",
      }),
      targetLanguage: "th",
      userLanguage: "en",
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Spanish sentences for advanced grammar - subjunctive mood with complex verb forms and abstract concepts.

SOURCE LESSON METADATA: advanced subjunctive and concessive expressions such as hubiera sabido, a pesar de que, no obstante, en caso de que, siempre y cuando.
Generated sentences should naturally cover this source scope.

DIFFICULTY: This is clearly an ADVANCED-level lesson. Chapter "Advanced Grammar" + Lesson "Subjunctive Mood in Complex Clauses" + advanced grammar constructions = advanced level.
- Sentences SHOULD use complex structures (subordinate clauses, conditional constructions, compound-complex sentences)
- Longer sentences (8+ words) are expected and appropriate
- Penalize if sentences are overly simplistic given the advanced vocabulary
- Advanced grammatical accuracy is critical (subjunctive mood usage must be correct)

ACCURACY PITFALLS - Penalize SEVERELY if:
- Sentences drift away from the source lesson scope
- Subjunctive mood is used incorrectly
- Conditional/hypothetical structures are grammatically wrong
- Translations don't accurately convey the nuanced meaning

CONTEXT EXPECTATIONS:
- Sentences demonstrating complex hypothetical scenarios
- Professional, academic, or sophisticated conversational contexts
- Proper use of subjunctive triggers (doubt, emotion, hypothetical, concession)

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-advanced-grammar",
    userInput: {
      chapterTitle: "Advanced Grammar",
      lessonDescription:
        "Master the subjunctive mood in complex clause structures, including conditional, concessive, and hypothetical expressions.",
      lessonTitle: "Subjunctive Mood in Complex Clauses",
      sourceLessons: sourceLessonMetadata({
        description:
          "Advanced subjunctive and concessive expressions such as hubiera sabido, a pesar de que, no obstante, en caso de que, and siempre y cuando.",
        title: "Advanced Clause Vocabulary",
      }),
      targetLanguage: "es",
      userLanguage: "en",
    },
  },
];
