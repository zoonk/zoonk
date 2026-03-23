const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. MONOLINGUAL OUTPUT (CRITICAL - highest priority):
   - ALL text MUST be in the TARGET language ONLY
   - There should be NO translations, NO user-language text, NO romanization
   - This task produces raw grammar content; enrichment is done separately
   - Penalize SEVERELY if any non-target-language text appears in examples or exercises

2. EXAMPLES QUALITY:
   - Must include 3-4 example sentences demonstrating the grammar pattern
   - Each example MUST have a "highlight" field isolating the grammar element
   - Examples should make the pattern discoverable without explanation
   - Sentences should be simple enough for learners to focus on the pattern
   - Penalize if examples are unrelated to the grammar pattern or too complex

3. EXERCISES - FILL-IN-THE-BLANK:
   - Must include 2-3 fill-in-the-blank exercises
   - Each exercise MUST have exactly one [BLANK] placeholder in the template
   - The answers array MUST contain the correct answer(s)
   - Distractors MUST be plausible wrong answers testing common mistakes
   - Templates must contain ONLY target language text and [BLANK]
   - Penalize SEVERELY if exercises test different grammar than the examples

4. LINGUISTIC ACCURACY (CRITICAL):
   - ALL sentences must be grammatically correct in the target language
   - The grammar pattern described must match what is actually demonstrated
   - Highlights must correctly isolate the relevant grammar element
   - Penalize SEVERELY for incorrect grammar

5. PEDAGOGICAL QUALITY:
   - Examples should progress from simple to slightly more complex
   - Exercises should reinforce the pattern shown in examples
   - Content should be appropriate for language learners

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize for specific example sentences - accept ANY valid sentences demonstrating the pattern
- Do NOT penalize for specific vocabulary choices
- Do NOT require specific phrases or sentence structures
- FOCUS ON: monolingual correctness, structural completeness, linguistic accuracy, pattern clarity
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Japanese

TOPIC: Topic marker particle (wa) - how it marks the topic of a sentence.

GRAMMAR PATTERN: The particle marks the topic of a sentence, indicating what the sentence is about. It attaches to nouns to establish them as the topic of discussion.

MONOLINGUAL CHECK:
- ALL examples and exercises must be in Japanese ONLY
- No English translations should appear anywhere
- No romanization (romaji) should appear anywhere
- Highlights should isolate the particle

${SHARED_EXPECTATIONS}
    `,
    id: "ja-topic-marker-wa",
    userInput: {
      chapterTitle: "Basic Particles",
      lessonDescription:
        "The topic marker particle and how it indicates what the sentence is about",
      lessonTitle: "Topic Marker",
      targetLanguage: "ja",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish

TOPIC: Present tense conjugation of regular -ar verbs.

GRAMMAR PATTERN: Regular -ar verbs in Spanish follow a consistent conjugation pattern in present tense. The -ar ending is replaced with: -o (yo), -as (tu), -a (el/ella), -amos (nosotros), -an (ellos/ellas).

MONOLINGUAL CHECK:
- ALL examples and exercises must be in Spanish ONLY
- No English or other language translations
- Highlights should isolate the conjugated verb form

CONJUGATION PARADIGM COMPLETENESS:
- Examples should cover the key forms of the paradigm
- Penalize if a core person like "nosotros" is completely omitted from examples

${SHARED_EXPECTATIONS}
    `,
    id: "es-ar-verb-conjugation",
    userInput: {
      chapterTitle: "Verbos en Presente",
      lessonDescription: "Como conjugar verbos regulares terminados en -ar en el tiempo presente",
      lessonTitle: "Verbos Regulares -ar",
      targetLanguage: "es",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German

TOPIC: Verb-second (V2) word order in main clauses.

GRAMMAR PATTERN: In German declarative sentences, the conjugated verb MUST occupy the second position. The first position can be filled by the subject, an adverb, or another element, but the verb always comes second.

MONOLINGUAL CHECK:
- ALL examples and exercises must be in German ONLY
- No English or other language translations
- Highlights should isolate the verb in second position

ACCURACY PITFALLS:
- Penalize if examples show verb in positions other than second
- Penalize if examples use subordinate clauses (which have different word order)

${SHARED_EXPECTATIONS}
    `,
    id: "de-verb-second",
    userInput: {
      chapterTitle: "Satzstruktur",
      lessonDescription:
        "Die Verbzweitstellung im deutschen Hauptsatz und wie sie sich vom Englischen unterscheidet",
      lessonTitle: "Verbzweitstellung",
      targetLanguage: "de",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean

TOPIC: Subject markers (i) and (ga) - particles that mark the grammatical subject.

GRAMMAR PATTERN: Korean uses one marker after consonant-ending nouns and another after vowel-ending nouns to mark the grammatical subject.

MONOLINGUAL CHECK:
- ALL examples and exercises must be in Korean ONLY
- No English, Spanish, or other language translations
- No romanization should appear anywhere
- Highlights should isolate the subject marker particle

ACCURACY PITFALLS:
- Marker usage must match the consonant/vowel ending of the noun
- Penalize if the wrong marker is used for the noun ending

${SHARED_EXPECTATIONS}
    `,
    id: "ko-subject-markers",
    userInput: {
      chapterTitle: "기본 조사",
      lessonDescription: "주격 조사 이/가의 사용법과 받침에 따른 선택 규칙",
      lessonTitle: "주격 조사 이/가",
      targetLanguage: "ko",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: French

TOPIC: Adjective-noun gender agreement.

GRAMMAR PATTERN: In French, adjectives must agree in gender with the noun they modify. Masculine nouns take masculine adjectives; feminine nouns take feminine adjectives. Most adjectives add -e for feminine form.

MONOLINGUAL CHECK:
- ALL examples and exercises must be in French ONLY
- No translations in any other language
- Highlights should isolate the adjective showing agreement

ACCURACY PITFALLS:
- Penalize if adjective forms do not match noun gender
- Penalize if examples use invariable adjectives that do not demonstrate the pattern

${SHARED_EXPECTATIONS}
    `,
    id: "fr-gender-agreement",
    userInput: {
      chapterTitle: "Les adjectifs",
      lessonDescription:
        "Comment les adjectifs en francais s'accordent en genre avec les noms qu'ils modifient",
      lessonTitle: "Accord en genre",
      targetLanguage: "fr",
    },
  },
];
