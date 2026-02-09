const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. VOCABULARY WORD USAGE (CRITICAL - highest priority):
   - Each generated sentence MUST use at least one of the provided vocabulary words
   - The words should be used in their natural form (conjugated verbs, declined nouns are acceptable)
   - Penalize SEVERELY if sentences don't incorporate the provided vocabulary
   - Penalize if words are used incorrectly or out of context

2. TRANSLATION ACCURACY (CRITICAL):
   - Each sentence-translation pair MUST be linguistically accurate
   - The translation must convey the same meaning as the original sentence
   - Consider regional variations (Brazilian Portuguese vs European, Latin American Spanish vs Castilian)
   - Penalize SEVERELY if translations are incorrect, incomplete, or misleading
   - Grammatical structures should be appropriately adapted between languages

3. ROMANIZATION (required field):
   - For Japanese, Chinese, Korean, Arabic, Russian, Greek, Thai, Hindi, etc.: romanization MUST contain the Roman letter representation of the sentence
   - Use standard romanization systems (romaji for Japanese, pinyin for Chinese, etc.)
   - For Roman-script languages (Spanish, French, German, etc.): romanization MUST be an empty string ""
   - Penalize if romanization is missing for non-Roman scripts or contains text for Roman scripts

4. GRAMMATICAL CORRECTNESS:
   - Sentences must be grammatically correct in the target language
   - Verb conjugations must match the subject
   - Gender agreement must be correct where applicable
   - Word order should follow natural patterns of the target language
   - Penalize for grammar errors, incorrect conjugations, or unnatural constructions

5. SENTENCE NATURALNESS:
   - Sentences should sound natural to native speakers
   - Avoid overly literal translations or awkward phrasing
   - Use appropriate register (formal/informal) for the context
   - Penalize if sentences sound robotic, unnatural, or like machine translation

6. CONTEXT DIVERSITY:
   - Sentences should present different contexts or situations
   - Avoid repetitive sentence structures
   - Use variety in sentence types (statements, questions, commands where appropriate)
   - Do NOT penalize for covering similar themes if vocabulary words naturally relate to each other

7. LESSON RELEVANCE:
   - Sentences should relate to the lesson topic
   - The contexts should be appropriate for the lesson's educational goals
   - Avoid straying into unrelated topics
   - Do NOT require every sentence to explicitly reference the lesson topic - implicit relevance is fine

8. APPROPRIATE DIFFICULTY:
   - Sentences should be appropriate for language learners
   - Avoid overly complex grammatical structures unless the lesson specifically targets advanced learners
   - Vocabulary beyond the provided words should be at a similar or simpler level
   - Penalize if sentences are incomprehensible to learners or use excessive advanced vocabulary

9. NO DUPLICATES:
   - Each sentence should be unique
   - Avoid near-duplicates (same sentence with minor word changes)
   - Penalize if essentially the same sentence appears multiple times

10. LANGUAGE CORRECTNESS:
    - Sentences should be in the TARGET language (courseTitle)
    - Translations should be in the NATIVE language (language code)
    - Penalize if languages are swapped or mixed incorrectly

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific sentence choices - accept ANY valid sentences that use the vocabulary
- Do NOT penalize for not including specific contexts you might expect
- Do NOT require a specific number of sentences
- Do NOT expect sentences to follow any particular template or pattern
- Different valid sentence constructions exist - assess the quality of what IS provided
- FOCUS ON: vocabulary usage, translation accuracy, romanization correctness, grammatical correctness, naturalness
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Spanish sentences for greetings and introductions - using basic greeting vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: hola, buenos dias, buenas noches, adios, gracias
These words MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Greetings are used incorrectly (e.g., "buenas noches" used for morning)
- Translations don't match the Spanish sentences
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences should demonstrate natural use of greetings
- Various social situations (meeting someone, saying goodbye, thanking)
- Different times of day where appropriate

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-greetings",
    userInput: {
      lessonTitle: "Greetings and Introductions",
      targetLanguage: "Spanish",
      userLanguage: "en",
      words: ["hola", "buenos dias", "buenas noches", "adios", "gracias"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: French sentences for food and dining - using food-related vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: le pain, le fromage, le vin, la soupe, le dessert
These words MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Food items are used in unrealistic contexts
- Gender agreement is incorrect (le/la must match the noun)
- Translations don't accurately convey the French meaning
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences about ordering, eating, or discussing food
- Restaurant or home dining situations
- Natural food-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-french-food",
    userInput: {
      lessonTitle: "Food and Dining",
      targetLanguage: "French",
      userLanguage: "en",
      words: ["le pain", "le fromage", "le vin", "la soupe", "le dessert"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: German sentences for family members - using family vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: die Mutter, der Vater, die Schwester, der Bruder, die Familie
These words MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Case endings are incorrect (nominative, accusative, dative contexts)
- Article-noun agreement is wrong
- Translations don't accurately convey the German meaning
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences about family relationships and activities
- Talking about or introducing family members
- Family-related situations and conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-family",
    userInput: {
      lessonTitle: "Family Members",
      targetLanguage: "German",
      userLanguage: "en",
      words: ["die Mutter", "der Vater", "die Schwester", "der Bruder", "die Familie"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Japanese sentences for numbers and counting - using basic number vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: 一, 二, 三, 五, 十
These number kanji MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romaji for all Japanese sentences
- Standard Hepburn romanization preferred
- Numbers: 一 (ichi), 二 (ni), 三 (san), 五 (go), 十 (juu)
- Penalize if romanization is missing or uses non-standard systems

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided number kanji
- Counter words are used incorrectly
- Japanese number readings are wrong in context
- Translations don't match the Japanese sentences
- Romanization is missing or incorrect

CONTEXT EXPECTATIONS:
- Sentences using numbers in practical contexts (counting, telling age, quantities)
- Natural use of Japanese counters where appropriate
- Various everyday situations involving numbers

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-numbers",
    userInput: {
      lessonTitle: "Numbers and Counting",
      targetLanguage: "Japanese",
      userLanguage: "en",
      words: ["一", "二", "三", "五", "十"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Korean sentences for colors - using basic color vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: 빨간색, 파란색, 노란색, 초록색, 검은색
These color words MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romanized Korean for all sentences
- Standard Korean romanization (Revised Romanization preferred)
- Colors: 빨간색 (ppalgansaek), 파란색 (paransaek), 노란색 (noransaek), etc.
- Penalize if romanization is missing or incorrect

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided color words
- Color words are used grammatically incorrectly
- Translations don't match the Korean sentences
- Romanization is missing or uses non-standard systems

CONTEXT EXPECTATIONS:
- Sentences describing objects by color
- Shopping or everyday situations involving colors
- Natural Korean sentence structures

${SHARED_EXPECTATIONS}
    `,
    id: "en-korean-colors",
    userInput: {
      lessonTitle: "Colors",
      targetLanguage: "Korean",
      userLanguage: "en",
      words: ["빨간색", "파란색", "노란색", "초록색", "검은색"],
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: Italian sentences for travel and transportation - using travel vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: il treno, l'aereo, la macchina, il biglietto, la stazione
These words MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Article contractions are incorrect (e.g., l'aereo not la aereo)
- Translations are in English instead of Portuguese
- Gender agreement is incorrect
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences about traveling, booking tickets, transportation
- Natural travel-related conversations
- Various modes of transportation

${SHARED_EXPECTATIONS}
    `,
    id: "pt-italian-travel",
    userInput: {
      lessonTitle: "Viagens e Transporte",
      targetLanguage: "Italian",
      userLanguage: "pt",
      words: ["il treno", "l'aereo", "la macchina", "il biglietto", "la stazione"],
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: Spanish sentences for shopping - using shopping vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: comprar, la tienda, el precio, caro, barato
These words MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Verb conjugation is incorrect (comprar conjugated forms)
- Adjective gender agreement is wrong (caro/cara, barato/barata)
- Translations are in English instead of Portuguese
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences about buying, prices, stores
- Shopping conversations and situations
- Natural commercial interactions

${SHARED_EXPECTATIONS}
    `,
    id: "pt-spanish-shopping",
    userInput: {
      lessonTitle: "Compras",
      targetLanguage: "Spanish",
      userLanguage: "pt",
      words: ["comprar", "la tienda", "el precio", "caro", "barato"],
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required for translations (NOT English).

TOPIC: French sentences for weather - using weather vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: le soleil, la pluie, le vent, il fait chaud, il fait froid
These words/expressions MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words/expressions
- Weather expressions are used incorrectly
- Translations are in English instead of Spanish
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences describing weather conditions
- Planning activities based on weather
- Natural weather-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "es-french-weather",
    userInput: {
      lessonTitle: "El Clima",
      targetLanguage: "French",
      userLanguage: "es",
      words: ["le soleil", "la pluie", "le vent", "il fait chaud", "il fait froid"],
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required for translations (NOT English).

TOPIC: Japanese sentences for time expressions - using time-related vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: 今日, 明日, 昨日, 朝, 夜
These time words MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romaji for all Japanese sentences
- Standard Hepburn romanization preferred
- Time words: 今日 (kyou), 明日 (ashita), 昨日 (kinou), 朝 (asa), 夜 (yoru)
- Penalize if romanization is missing or uses non-standard systems

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided time words
- Time expressions are used incorrectly in context
- Translations are in English instead of Spanish
- Romanization is missing or incorrect

CONTEXT EXPECTATIONS:
- Sentences about daily activities and schedules
- References to different times of day
- Natural Japanese time expressions

${SHARED_EXPECTATIONS}
    `,
    id: "es-japanese-time",
    userInput: {
      lessonTitle: "Expresiones de Tiempo",
      targetLanguage: "Japanese",
      userLanguage: "es",
      words: ["今日", "明日", "昨日", "朝", "夜"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Mandarin Chinese sentences for common verbs - using action verbs.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: 吃, 喝, 看, 听, 说
These verbs MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include pinyin for all Chinese sentences
- Include tone marks or numbers
- Verbs: 吃 (chī), 喝 (hē), 看 (kàn), 听 (tīng), 说 (shuō)
- Penalize if romanization is missing or doesn't include tones

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided verbs
- Chinese word order is incorrect
- Aspect markers are used incorrectly (了, 着, 过)
- Translations don't match the Chinese sentences
- Romanization is missing or doesn't include tones

CONTEXT EXPECTATIONS:
- Sentences demonstrating various uses of these common verbs
- Daily life activities (eating, drinking, watching, listening, speaking)
- Natural Chinese sentence structures

${SHARED_EXPECTATIONS}
    `,
    id: "en-chinese-verbs",
    userInput: {
      lessonTitle: "Common Verbs",
      targetLanguage: "Mandarin Chinese",
      userLanguage: "en",
      words: ["吃", "喝", "看", "听", "说"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Russian sentences for places in the city - using location vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: магазин, ресторан, парк, школа, библиотека
These place words MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romanized Russian for all sentences
- Standard transliteration system
- Words: магазин (magazin), ресторан (restoran), парк (park), школа (shkola), библиотека (biblioteka)
- Penalize if romanization is missing or incorrect

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided place words
- Case endings are incorrect (prepositional for location, accusative for direction)
- Preposition usage is wrong (в/на)
- Translations don't match the Russian sentences
- Romanization is missing or uses non-standard systems

CONTEXT EXPECTATIONS:
- Sentences about going to places, being at places
- Giving and asking directions
- Natural urban/location-related conversations

${SHARED_EXPECTATIONS}
    `,
    id: "en-russian-places",
    userInput: {
      lessonTitle: "Places in the City",
      targetLanguage: "Russian",
      userLanguage: "en",
      words: ["магазин", "ресторан", "парк", "школа", "библиотека"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Arabic sentences for common adjectives - using descriptive vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: كبير, صغير, جميل, جديد, قديم
These adjectives MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romanized Arabic for all sentences
- Standard transliteration
- Words: كبير (kabir), صغير (saghir), جميل (jamil), جديد (jadid), قديم (qadim)
- Penalize if romanization is missing or incorrect

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided adjectives
- Adjective-noun agreement is incorrect (gender, number)
- Word order is unnatural
- Translations don't match the Arabic sentences
- Romanization is missing or uses non-standard systems

CONTEXT EXPECTATIONS:
- Sentences describing objects, people, or places
- Comparative contexts where natural
- Natural Arabic descriptive constructions

${SHARED_EXPECTATIONS}
    `,
    id: "en-arabic-adjectives",
    userInput: {
      lessonTitle: "Common Adjectives",
      targetLanguage: "Arabic",
      userLanguage: "en",
      words: ["كبير", "صغير", "جميل", "جديد", "قديم"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Portuguese sentences for emotions and feelings - using emotion vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: feliz, triste, cansado, com fome, com sede
These words/expressions MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided vocabulary words
- Estar vs ser usage is incorrect for states (estar feliz, not ser feliz for temporary states)
- Gender agreement is wrong (cansado/cansada)
- Translations don't match the Portuguese sentences
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences expressing how someone feels
- Various situations causing different emotions
- Natural emotional expressions in Portuguese

${SHARED_EXPECTATIONS}
    `,
    id: "en-portuguese-emotions",
    userInput: {
      lessonTitle: "Emotions and Feelings",
      targetLanguage: "Portuguese",
      userLanguage: "en",
      words: ["feliz", "triste", "cansado", "com fome", "com sede"],
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required for translations (NOT English).

TOPIC: German sentences for daily routines - using routine action vocabulary.

SCRIPT: Roman (romanization should be empty string "")

VOCABULARY WORDS PROVIDED: aufstehen, fruhstucken, arbeiten, schlafen, essen
These verbs MUST appear in the generated sentences.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided verbs
- Separable prefix verbs are handled incorrectly (aufstehen -> ich stehe auf)
- Verb conjugation is wrong
- Translations are in English instead of Portuguese
- Romanization contains any text (should be empty string)

CONTEXT EXPECTATIONS:
- Sentences about daily activities and schedules
- Morning, work, and evening routines
- Natural German verb usage in context

${SHARED_EXPECTATIONS}
    `,
    id: "pt-german-routines",
    userInput: {
      lessonTitle: "Rotinas Diarias",
      targetLanguage: "German",
      userLanguage: "pt",
      words: ["aufstehen", "fruhstucken", "arbeiten", "schlafen", "essen"],
    },
  },
  {
    expectations: `
LANGUAGE: English output required for translations.

TOPIC: Thai sentences for polite expressions - using politeness vocabulary.

SCRIPT: Non-Roman (romanization MUST be included)

VOCABULARY WORDS PROVIDED: ขอบคุณ, ขอโทษ, ได้โปรด, สวัสดี, ลาก่อน
These polite expressions MUST appear in the generated sentences.

ROMANIZATION REQUIREMENTS:
- MUST include romanized Thai for all sentences
- Standard transliteration with tone indicators where helpful
- Words: ขอบคุณ (khob khun), ขอโทษ (kho thot), etc.
- Penalize if romanization is missing or unclear

ACCURACY PITFALLS - Penalize SEVERELY if:
- Any sentence doesn't use at least one of the provided expressions
- Politeness particles are missing where required (ครับ/คะ)
- Translations don't match the Thai sentences
- Romanization is missing or inconsistent

CONTEXT EXPECTATIONS:
- Sentences demonstrating polite interactions
- Social situations requiring courtesy
- Natural Thai politeness conventions

${SHARED_EXPECTATIONS}
    `,
    id: "en-thai-politeness",
    userInput: {
      lessonTitle: "Polite Expressions",
      targetLanguage: "Thai",
      userLanguage: "en",
      words: ["ขอบคุณ", "ขอโทษ", "ได้โปรด", "สวัสดี", "ลาก่อน"],
    },
  },
];
