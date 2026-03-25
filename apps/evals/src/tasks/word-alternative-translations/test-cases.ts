const SHARED_EXPECTATIONS = `
CONTEXT: Alternative translations are used to prevent semantically equivalent words from appearing as distractors (wrong answer options) in exercises. For example, in an arrange-words activity where the learner translates "oi, boa noite" ("hi, good evening"), we show individual word tokens alongside distractor words. Without alternatives, "good night" could appear as a distractor — but it's a valid translation of "boa noite". Marking it as an alternative excludes it from the distractor pool so learners never see a correct answer presented as wrong.

EVALUATION CRITERIA:

1. GENUINE EQUIVALENCE (CRITICAL - highest priority):
   - Every alternative MUST be a genuinely equivalent translation of the word
   - Alternatives must be interchangeable in the same context as the primary translation
   - Penalize SEVERELY if loosely related words are included (e.g., "house" as alternative for "home" when the word means "apartment")
   - Do NOT include the primary translation in the alternatives array

2. COMPLETENESS:
   - Words with multiple common translations MUST have alternatives listed
   - Penalize if an obvious equivalent is missing (e.g., "good evening" missing for "boa noite" when translation is "good night")
   - Kinship synonyms should be included (e.g., "Mom", "Momma", "Mommy" for a word meaning "mother")

3. EMPTY ARRAY WHEN APPROPRIATE:
   - Words with only one clear translation should return an empty array
   - Do NOT pad the array with loosely related words just to have content
   - Penalize if alternatives are forced for unambiguous words

4. BIDIRECTIONAL SYNONYMS:
   - Consider synonyms in both directions
   - If the user language has multiple words mapping to the same target word, list them
   - Example: Italian "ciao" means both "hello" and "bye" - both should appear as alternatives

5. NO PARAPHRASES OR TONE SHIFTS:
   - Alternatives must be word-for-word equivalent, not explanations or paraphrases
   - Do NOT include different speech acts (e.g., "Nice to meet you" as alternative for "Hello")
   - Penalize if alternatives change the register or formality level significantly

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require specific alternatives - accept any genuinely equivalent translations
- Do NOT penalize for including valid alternatives you didn't expect
- FOCUS ON: equivalence quality, completeness for multi-meaning words, empty arrays for unambiguous words
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Portuguese
USER LANGUAGE: English
WORD: "boa noite" (translation: "good evening")

This Portuguese greeting maps to both "good evening" and "good night" in English.

EXPECTED BEHAVIOR:
- MUST include "good night" as an alternative (this is the most critical test)
- May include other valid equivalents
- Penalize SEVERELY if alternativeTranslations is empty

${SHARED_EXPECTATIONS}
    `,
    id: "pt-en-boa-noite",
    userInput: {
      targetLanguage: "pt",
      translation: "good evening",
      userLanguage: "en",
      word: "boa noite",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Italian
USER LANGUAGE: English
WORD: "ciao" (translation: "hello")

Italian "ciao" is used for both greeting and farewell.

EXPECTED BEHAVIOR:
- MUST include farewell equivalents like "bye", "goodbye"
- May include informal greeting variants like "hi"
- Penalize SEVERELY if alternativeTranslations is empty

${SHARED_EXPECTATIONS}
    `,
    id: "it-en-ciao",
    userInput: {
      targetLanguage: "it",
      translation: "hello",
      userLanguage: "en",
      word: "ciao",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English
WORD: "die Mama" (translation: "Mom")

This is a kinship term with common informal variants.

EXPECTED BEHAVIOR:
- Should include variants like "Momma", "Mommy", "Mama"
- These are genuinely interchangeable kinship synonyms
- Penalize if no alternatives are provided

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-mama",
    userInput: {
      targetLanguage: "de",
      translation: "Mom",
      userLanguage: "en",
      word: "die Mama",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English
WORD: "el gato" (translation: "the cat")

This is an unambiguous word with one clear translation.

EXPECTED BEHAVIOR:
- alternativeTranslations should be an empty array
- "the cat" is the only valid translation
- Penalize if loosely related words are included (e.g., "kitten", "feline")

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-gato",
    userInput: {
      targetLanguage: "es",
      translation: "the cat",
      userLanguage: "en",
      word: "el gato",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Portuguese
USER LANGUAGE: English
WORD: "oi" (translation: "hi")

This is a common informal Portuguese greeting.

EXPECTED BEHAVIOR:
- Should include "hello" and possibly "hey" as alternatives
- These are genuinely equivalent greetings
- Penalize if empty (obvious overlapping translations exist)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-en-oi",
    userInput: {
      targetLanguage: "pt",
      translation: "hi",
      userLanguage: "en",
      word: "oi",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Portuguese
WORD: "der Papa" (translation: "o papai")

Kinship term with Portuguese informal variants.

EXPECTED BEHAVIOR:
- Should include variants like "o pai", "papai" or similar
- Output must be in Portuguese, not English
- Penalize if empty (kinship terms typically have variants)

${SHARED_EXPECTATIONS}
    `,
    id: "de-pt-papa",
    userInput: {
      targetLanguage: "de",
      translation: "o papai",
      userLanguage: "pt",
      word: "der Papa",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Japanese
USER LANGUAGE: English
WORD: "猫" (translation: "cat")

Simple, unambiguous word in a non-Roman script.

EXPECTED BEHAVIOR:
- alternativeTranslations should be an empty array
- "cat" is the only valid translation
- Tests that non-Roman script words are handled correctly

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-neko",
    userInput: {
      targetLanguage: "ja",
      translation: "cat",
      userLanguage: "en",
      word: "猫",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: Portuguese
WORD: "buenas noches" (translation: "boa noite")

Spanish "buenas noches" maps to both "boa noite" (as evening greeting and goodnight farewell) in Portuguese. Since Portuguese uses the same phrase for both, alternatives might be empty or include subtle variants.

EXPECTED BEHAVIOR:
- May have an empty array since Portuguese uses "boa noite" for both meanings
- Tests non-English user language with overlapping translations
- Do NOT penalize for empty array here since the primary translation already covers both senses

${SHARED_EXPECTATIONS}
    `,
    id: "es-pt-buenas-noches",
    userInput: {
      targetLanguage: "es",
      translation: "boa noite",
      userLanguage: "pt",
      word: "buenas noches",
    },
  },
];
