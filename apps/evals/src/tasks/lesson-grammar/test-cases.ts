const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. LANGUAGE CONTRACT (CRITICAL - highest priority):
   - explanations.title, explanations.text, examples.translation, questions.feedback, and non-null questions.question MUST be in the USER language
   - examples.sentence, examples.highlight, questions.template, questions.answer, and questions.distractors MUST be in the TARGET language
   - There should be NO romanization
   - Penalize SEVERELY if learner-facing explanations are in the target language instead of the user language
   - Penalize SEVERELY if target-language practice fields contain translated/user-language answers
   - Format tokens ([BLANK] placeholder, JSON keys) are part of the required output structure, NOT language-mixing issues

2. EXPLANATION-FIRST TEACHING:
   - Must include 1-3 explanation sections
   - Explanations must teach what to look for before the learner sees examples
   - Do NOT use a discovery-question approach that asks learners to infer the rule before it is explained
   - Explanations should be short, concrete, and beginner-safe
   - Do NOT penalize the JSON object key order. Only evaluate whether the content supports an explanation-first lesson when saved/rendered.

3. TARGET-LANGUAGE HIGHLIGHTING:
   - When explanations.text mentions a target-language word, phrase, particle, or form inside user-language prose, that target-language text should be wrapped in single backticks
   - Do NOT require backticks around user-language words
   - Do NOT reward or require bold, italic, or other rich-text formats for this highlighting rule
   - Only evaluate this rule for explanations.text. Do NOT require this formatting in examples, questions, feedback, translations, or target-language fields.

4. EXAMPLES QUALITY:
   - Must include 2-4 example sentences demonstrating the grammar pattern
   - Each example MUST have a highlight field isolating the grammar element
   - Each example MUST have a natural user-language translation
   - Sentences should be simple enough for learners to focus on the pattern

5. QUESTIONS - FILL-IN-THE-BLANK:
   - Must include 1-3 fill-in-the-blank questions
   - The question prompt may be null when the template is self-explanatory
   - Each question MUST have exactly one [BLANK] placeholder in the template
   - The answer field MUST contain exactly one correct answer (a single string, not an array)
   - Distractors MUST be plausible wrong answers testing common mistakes
   - Feedback MUST explain why the correct answer fits the grammar pattern
   - Penalize SEVERELY if questions test different grammar than the examples

6. LINGUISTIC ACCURACY (CRITICAL):
   - ALL target-language sentences, templates, and answers must be grammatically valid
   - Distractors should be plausible learner mistakes or real forms used in the wrong context. Do not require distractors to make the completed sentence grammatical, but penalize malformed fake forms that a learner would not reasonably produce.
   - The explanation must match what examples and questions actually demonstrate
   - Penalize SEVERELY for incorrect grammar or misleading explanations

7. HIGHLIGHT SCOPE:
   - Highlights that include slightly more context than the minimum (e.g., noun+particle, subject+verb, noun+adjective+article) are acceptable as long as the target grammar element is clearly visible
   - Only penalize if the highlight is so broad that the grammar element is buried or unclear

8. PARADIGM AND FORM COVERAGE:
   - For conjugation patterns, evaluate coverage across examples AND questions combined as a single set
   - For agreement patterns, prefer forms where the contrast is visible (e.g., adjectives with clearly different masculine/feminine forms over invariable ones)

9. SCRIPT CONSISTENCY (for non-Roman scripts):
   - Only penalize if the SAME word is written in different scripts across examples and questions
   - Different words using different scripts is normal and not a consistency issue

SCORING DISCIPLINE (CRITICAL - read before assigning a score):
- If something is explicitly marked as acceptable in the criteria above, do NOT deduct points for it.
- Only deduct for CONCRETE errors: wrong grammar, wrong answers, missing structural requirements, wrong language, or unclear rule alignment.
- Do NOT deduct for specific vocabulary choices, sentence structures, or sentence variety.
- FOCUS ON: explanation-first structure, language contract, target-language highlighting in explanations.text, structural completeness, linguistic accuracy, pattern clarity.
`;

/**
 * Keeps each case focused on where each language should appear instead of
 * repeating target/user language metadata that is already present in input.
 */
function languageExpectations({
  targetLanguage,
  userLanguage,
}: {
  targetLanguage: string;
  userLanguage: string;
}) {
  return `
LANGUAGE EXPECTATIONS:

- Explanations, example translations, non-null question prompts, and feedback should be in ${userLanguage}, except when quoting ${targetLanguage}.
- Example sentences, highlights, fill-in-the-blank templates, answers, and distractors should be in ${targetLanguage}.
`;
}

export const TEST_CASES = [
  {
    expectations: `
${languageExpectations({ targetLanguage: "Japanese", userLanguage: "English" })}

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
      userLanguage: "en",
    },
  },
  {
    expectations: `
${languageExpectations({ targetLanguage: "Spanish", userLanguage: "English" })}

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
      userLanguage: "en",
    },
  },
  {
    expectations: `
${languageExpectations({ targetLanguage: "German", userLanguage: "English" })}

TOPIC: Verb-second (V2) word order in main clauses.

GRAMMAR PATTERN: In German declarative sentences, the conjugated verb must occupy the second position. The first position can be filled by the subject, an adverb, or another element, but the verb always comes second.

ACCURACY PITFALLS:
- Penalize if examples show the verb outside the second position.
- Penalize if examples use subordinate clauses, which have different word order.

${SHARED_EXPECTATIONS}
    `,
    id: "de-verb-second",
    userInput: {
      chapterTitle: "Satzstruktur",
      lessonDescription:
        "Die Verbzweitstellung im deutschen Hauptsatz und wie sie sich vom Englischen unterscheidet",
      lessonTitle: "Verbzweitstellung",
      targetLanguage: "de",
      userLanguage: "en",
    },
  },
  {
    expectations: `
${languageExpectations({ targetLanguage: "Korean", userLanguage: "Brazilian Portuguese" })}

TOPIC: Subject markers (i) and (ga) - particles that mark the grammatical subject.

GRAMMAR PATTERN: Korean uses one marker after consonant-ending nouns and another after vowel-ending nouns to mark the grammatical subject.

ACCURACY PITFALLS:
- Marker usage must match the consonant/vowel ending of the noun.
- Penalize if the wrong marker is used for the noun ending.

${SHARED_EXPECTATIONS}
    `,
    id: "ko-subject-markers",
    userInput: {
      chapterTitle: "기본 조사",
      lessonDescription: "주격 조사 이/가의 사용법과 받침에 따른 선택 규칙",
      lessonTitle: "주격 조사 이/가",
      targetLanguage: "ko",
      userLanguage: "pt",
    },
  },
  {
    expectations: `
${languageExpectations({ targetLanguage: "French", userLanguage: "Latin American Spanish" })}

TOPIC: Adjective-noun gender agreement.

GRAMMAR PATTERN: In French, adjectives must agree in gender with the noun they modify. Masculine nouns take masculine adjectives; feminine nouns take feminine adjectives. Most adjectives add -e for feminine form.

ACCURACY PITFALLS:
- Penalize if adjective forms do not match noun gender.
- Penalize if examples or questions use invariable adjectives, because they fail to demonstrate visible gender contrast.

${SHARED_EXPECTATIONS}
    `,
    id: "fr-gender-agreement",
    userInput: {
      chapterTitle: "Les adjectifs",
      lessonDescription:
        "Comment les adjectifs en français s'accordent en genre avec les noms qu'ils modifient",
      lessonTitle: "Accord en genre",
      targetLanguage: "fr",
      userLanguage: "es",
    },
  },
];
