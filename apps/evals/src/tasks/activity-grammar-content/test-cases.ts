const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. MONOLINGUAL OUTPUT (CRITICAL - highest priority):
   - ALL text MUST be in the TARGET language ONLY
   - There should be NO translations, NO user-language text, NO romanization
   - This task produces raw grammar content; enrichment is done separately
   - Penalize SEVERELY if any non-target-language text appears in examples or exercises
   - Format tokens ([BLANK] placeholder, JSON keys) are part of the required output structure, NOT language-mixing issues

2. EXAMPLES QUALITY:
   - Must include 2-4 example sentences demonstrating the grammar pattern
   - Each example MUST have a "highlight" field isolating the grammar element
   - Examples should make the pattern discoverable without explanation
   - Sentences should be simple enough for learners to focus on the pattern

3. EXERCISES - FILL-IN-THE-BLANK:
   - Must include 1-3 fill-in-the-blank exercises
   - Each exercise MUST have exactly one [BLANK] placeholder in the template
   - The answer field MUST contain exactly one correct answer (a single string, not an array)
   - Distractors MUST be plausible wrong answers testing common mistakes
   - Penalize SEVERELY if exercises test different grammar than the examples

4. LINGUISTIC ACCURACY (CRITICAL):
   - ALL sentences must be grammatically correct in the target language
   - The grammar pattern described must match what is actually demonstrated
   - Penalize SEVERELY for incorrect grammar

5. HIGHLIGHT SCOPE:
   - Highlights that include slightly more context than the minimum (e.g., noun+particle, subject+verb, noun+adjective+article) are acceptable as long as the target grammar element is clearly visible
   - Only penalize if the highlight is so broad that the grammar element is buried or unclear

6. PARADIGM AND FORM COVERAGE:
   - For conjugation patterns, evaluate coverage across examples AND exercises combined as a single set
   - For agreement patterns, prefer forms where the contrast is visible (e.g., adjectives with clearly different masculine/feminine forms over invariable ones)

7. SCRIPT CONSISTENCY (for non-Roman scripts):
   - Only penalize if the SAME word is written in different scripts across examples and exercises
   - Different words using different scripts is normal and not a consistency issue

SCORING DISCIPLINE (CRITICAL — read before assigning a score):
- If something is explicitly marked as acceptable in the criteria above, do NOT deduct points for it. Acknowledging a rule then still penalizing violates these instructions.
- Only deduct for CONCRETE errors: wrong grammar, wrong answers, missing structural requirements, or target language violations.
- Do NOT deduct for pedagogical preferences like "could have been broader", "slightly less canonical", or "would have been clearer with X". These are suggestions, not errors.
- Do NOT deduct for specific vocabulary choices, sentence structures, or sentence variety.
- FOCUS ON: monolingual correctness, structural completeness, linguistic accuracy, pattern clarity.
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Japanese

TOPIC: Topic marker particle (wa) - how it marks the topic of a sentence.

GRAMMAR PATTERN: The particle marks the topic of a sentence, indicating what the sentence is about. It attaches to nouns to establish them as the topic of discussion.

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

GRAMMAR PATTERN: Regular -ar verbs in Spanish follow a consistent conjugation pattern in present tense. The -ar ending is replaced with: -o (yo), -as (tú), -a (él/ella), -amos (nosotros), -an (ellos/ellas).

${SHARED_EXPECTATIONS}
    `,
    id: "es-ar-verb-conjugation",
    userInput: {
      chapterTitle: "Verbos en Presente",
      lessonDescription: "Cómo conjugar verbos regulares terminados en -ar en el tiempo presente",
      lessonTitle: "Verbos Regulares -ar",
      targetLanguage: "es",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German

TOPIC: Verb-second (V2) word order in main clauses.

GRAMMAR PATTERN: In German declarative sentences, the conjugated verb MUST occupy the second position. The first position can be filled by the subject, an adverb, or another element, but the verb always comes second.

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

ACCURACY PITFALLS:
- Penalize if adjective forms do not match noun gender
- Penalize if examples or exercises use invariable adjectives (identical masculine/feminine forms) — these fail to demonstrate visible gender contrast

${SHARED_EXPECTATIONS}
    `,
    id: "fr-gender-agreement",
    userInput: {
      chapterTitle: "Les adjectifs",
      lessonDescription:
        "Comment les adjectifs en français s'accordent en genre avec les noms qu'ils modifient",
      lessonTitle: "Accord en genre",
      targetLanguage: "fr",
    },
  },
];
