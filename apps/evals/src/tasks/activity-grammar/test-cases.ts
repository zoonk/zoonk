const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STRUCTURE - PATTERN DISCOVERY FORMAT (CRITICAL):
   The activity MUST follow the Pattern Discovery structure:
   - 3-4 examples demonstrating the grammar pattern
   - 1 discovery question with exactly 4 options (exactly 1 correct)
   - Brief rule summary (maximum 2 sentences)
   - 2-3 fill-in-the-blank exercises
   Penalize SEVERELY if any structural element is missing or malformed.

2. EXAMPLES QUALITY:
   - Each example MUST demonstrate the target grammar pattern
   - The highlight field MUST isolate the grammar element being taught
   - Examples should make the pattern discoverable WITHOUT explicit explanation
   - Translations MUST be accurate and natural in the output language
   - Sentences should be simple enough for learners to focus on the pattern
   - Penalize if examples are unrelated to the grammar pattern or too complex

3. DISCOVERY QUESTION:
   - MUST test pattern recognition, NOT memorization
   - MUST have exactly 4 options
   - MUST have exactly 1 correct option (isCorrect: true)
   - ALL options MUST have feedback explaining why they are correct/incorrect
   - Distractors should be plausible observations a learner might make
   - Penalize if the question tests vocabulary instead of grammar understanding

4. RULE SUMMARY:
   - MUST be maximum 2 sentences
   - MUST confirm what was discoverable from the examples
   - Use clear, simple language accessible to learners
   - Should NOT introduce new information not demonstrated in examples
   - Penalize if verbose, unclear, or contradicts the examples

5. EXERCISES - FILL-IN-THE-BLANK:
   - Each exercise MUST have exactly one [BLANK] placeholder
   - MUST test the same grammar pattern taught in examples
   - The answers array MUST contain the correct answer(s)
   - Distractors MUST be plausible wrong answers testing common mistakes
   - Feedback MUST explain why the correct answer fits the pattern
   - Penalize if exercises test different grammar or have unclear blanks

6. ROMANIZATION (CRITICAL):
   - For non-Roman scripts (Japanese, Korean, Chinese, Arabic, Russian, Greek, Thai, Hindi, etc.):
     romanization MUST be included and accurate using standard systems (romaji, romanization, pinyin, etc.)
   - For Roman-script languages (Spanish, French, German, Portuguese, Italian, etc.):
     romanization MUST be empty string ""
   - Penalize SEVERELY if romanization is missing for non-Roman scripts
   - Penalize SEVERELY if romanization contains text for Roman scripts

7. LINGUISTIC ACCURACY (CRITICAL - highest priority):
   - ALL sentences must be grammatically correct in the target language
   - ALL translations must be accurate and natural in the output language
   - Grammar explanations must be linguistically correct
   - The grammar pattern described must match what is actually demonstrated
   - Penalize SEVERELY for incorrect grammar or mistranslations

8. PEDAGOGICAL QUALITY:
   - Examples should progress from simple to slightly more complex
   - The discovery question should lead learners to the correct insight
   - Exercises should reinforce the discovered pattern
   - Content should be appropriate for language learners
   - Penalize if content is confusing, misleading, or pedagogically unsound

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific example sentences - accept ANY valid sentences demonstrating the pattern
- Do NOT penalize for specific vocabulary choices
- Do NOT require specific phrases or sentence structures
- Do NOT penalize for different valid approaches to explaining the grammar point
- FOCUS ON: structural correctness, linguistic accuracy, pattern clarity, romanization correctness
- Different valid teaching approaches exist - assess the quality of what IS provided
- The eval model should judge whether the output teaches the pattern effectively, not whether it matches a predetermined answer
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Japanese topic marker particle は (wa) - how it marks the topic of a sentence.

SCRIPT: Non-Roman (romanization MUST be included)

GRAMMAR PATTERN: The particle は (wa) marks the topic of a sentence, indicating what the sentence is about. It attaches to nouns to establish them as the topic of discussion.

ROMANIZATION REQUIREMENTS:
- MUST include romaji for all Japanese text
- Standard Hepburn romanization system
- The particle は when used as topic marker is romanized as "wa" (not "ha")

ACCURACY PITFALLS - Penalize SEVERELY if:
- は is romanized as "ha" when functioning as topic marker (should be "wa")
- Examples do not clearly demonstrate は as a topic marker
- Translations misrepresent what the topic marker does
- Romanization is missing or uses non-standard systems
- Discovery question tests vocabulary instead of understanding of topic marking
- Exercises have は in positions where it would not function as topic marker

${SHARED_EXPECTATIONS}
    `,
    id: "en-japanese-topic-marker-wa",
    userInput: {
      chapterTitle: "Basic Particles",
      courseTitle: "Japanese",
      language: "en",
      lessonDescription:
        "The topic marker particle は (wa) and how it indicates what the sentence is about",
      lessonTitle: "Topic Marker は",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: Spanish present tense conjugation of regular -ar verbs - how verbs ending in -ar change their endings to match the subject.

SCRIPT: Roman (romanization should be empty string "")

GRAMMAR PATTERN: Regular -ar verbs in Spanish follow a consistent conjugation pattern in present tense. The -ar ending is replaced with: -o (yo), -as (tu), -a (el/ella), -amos (nosotros), -an (ellos/ellas).

ACCURACY PITFALLS - Penalize SEVERELY if:
- Conjugation endings are incorrect
- Examples use irregular verbs instead of regular -ar verbs
- Examples mix -ar verbs with -er or -ir verbs (those belong in separate lessons)
- Romanization contains any text (should be empty string)
- Discovery question tests vocabulary instead of conjugation patterns
- Exercises test irregular verb forms

${SHARED_EXPECTATIONS}
    `,
    id: "en-spanish-ar-verb-conjugation",
    userInput: {
      chapterTitle: "Present Tense Verbs",
      courseTitle: "Spanish",
      language: "en",
      lessonDescription:
        "How to conjugate regular -ar verbs in the present tense, matching verb endings to subjects",
      lessonTitle: "Regular -ar Verbs",
    },
  },
  {
    expectations: `
LANGUAGE: English output required.

TOPIC: German verb-second (V2) word order - in German main clauses, the conjugated verb must be in the second position.

SCRIPT: Roman (romanization should be empty string "")

GRAMMAR PATTERN: In German declarative sentences, the conjugated verb MUST occupy the second position. The first position can be filled by the subject, an adverb, or another element, but the verb always comes second.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Examples show verb in positions other than second without explanation
- Examples use subordinate clauses (which have different word order)
- The pattern demonstrated is not clearly V2
- Romanization contains any text (should be empty string)
- Discovery question tests vocabulary instead of word order
- Exercises do not clearly test V2 word order

${SHARED_EXPECTATIONS}
    `,
    id: "en-german-verb-second",
    userInput: {
      chapterTitle: "Sentence Structure",
      courseTitle: "German",
      language: "en",
      lessonDescription:
        "Understanding German verb-second word order in main clauses and how it differs from English",
      lessonTitle: "Verb Second Word Order",
    },
  },
  {
    expectations: `
LANGUAGE: Brazilian Portuguese output required (NOT English).

TOPIC: French adjective-noun gender agreement - adjectives must match the gender of the noun they modify.

SCRIPT: Roman (romanization should be empty string "")

GRAMMAR PATTERN: In French, adjectives must agree in gender with the noun they modify. Masculine nouns take masculine adjectives; feminine nouns take feminine adjectives. Most adjectives add -e for feminine form.

ACCURACY PITFALLS - Penalize SEVERELY if:
- Output is in English instead of Portuguese
- Examples show incorrect gender agreement
- Adjective forms do not match noun gender
- Examples use invariable adjectives that do not demonstrate the pattern
- Romanization contains any text (should be empty string)
- Discovery question tests vocabulary instead of gender agreement
- Exercises do not clearly test gender agreement

${SHARED_EXPECTATIONS}
    `,
    id: "pt-french-gender-agreement",
    userInput: {
      chapterTitle: "Adjetivos",
      courseTitle: "French",
      language: "pt",
      lessonDescription:
        "Como os adjetivos em frances concordam em genero com os substantivos que modificam",
      lessonTitle: "Concordancia de Genero",
    },
  },
  {
    expectations: `
LANGUAGE: Latin American Spanish output required (NOT English).

TOPIC: Korean subject markers 이 (i) and 가 (ga) - particles that mark the subject of a sentence.

SCRIPT: Non-Roman (romanization MUST be included)

GRAMMAR PATTERN: Korean uses 이 after consonant-ending nouns and 가 after vowel-ending nouns to mark the grammatical subject. The choice depends on the final sound of the noun.

ROMANIZATION REQUIREMENTS:
- MUST include romanization for all Korean text
- Standard romanization system (Revised Romanization or similar)

ACCURACY PITFALLS - Penalize SEVERELY if:
- Output is in English instead of Spanish
- 이/가 usage does not match the consonant/vowel rule
- Examples do not clearly demonstrate when to use each marker
- Romanization is missing or incorrect
- Discovery question tests vocabulary instead of subject marker selection
- Exercises have markers that do not follow the consonant/vowel pattern

${SHARED_EXPECTATIONS}
    `,
    id: "es-korean-subject-marker",
    userInput: {
      chapterTitle: "Particulas Basicas",
      courseTitle: "Korean",
      language: "es",
      lessonDescription:
        "Los marcadores de sujeto coreanos 이 y 가 y como elegir cual usar segun la palabra",
      lessonTitle: "Marcadores de Sujeto",
    },
  },
];
