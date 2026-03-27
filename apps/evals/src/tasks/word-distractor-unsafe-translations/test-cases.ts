const SHARED_EXPECTATIONS = `
CONTEXT: distractorUnsafeTranslations are used only to prevent semantically equivalent words from appearing as distractors (wrong answer options) in exercises. For example, in an arrange-words activity where the learner translates "oi, boa noite" ("hi, good evening"), we show individual word tokens alongside distractor words. Without distractorUnsafeTranslations, "good night" could appear as a distractor even though it is also a valid translation of "boa noite". Marking it here excludes it from the distractor pool so learners never see a correct option presented as wrong.

EVALUATION CRITERIA:

1. GENUINE EQUIVALENCE (CRITICAL - highest priority):
   - Every distractor-unsafe translation MUST be a genuinely equivalent translation of the word
   - Each item must be interchangeable in the same context as the primary translation
   - Penalize SEVERELY if loosely related words are included (e.g., "house" for "apartment")
   - Do NOT include the primary translation in the \`distractorUnsafeTranslations\` array

2. COMPLETENESS:
   - Words with multiple common translations MUST have distractor-unsafe translations listed
   - Penalize if an obvious overlap is missing (e.g., "good evening" missing for "boa noite" when translation is "good night")
   - Kinship synonyms should be included (e.g., "Mom", "Momma", "Mommy" for a word meaning "mother")

3. EMPTY ARRAY WHEN APPROPRIATE:
   - Words with only one clear translation should return an empty array
   - Do NOT pad the array with loosely related words just to have content
   - Penalize if distractorUnsafeTranslations are forced for unambiguous words

4. BIDIRECTIONAL SYNONYMS:
   - Consider synonyms in both directions
   - If the user language has multiple words mapping to the same target word, list them
   - Example: Italian "ciao" means both "hello" and "bye" - both should appear in \`distractorUnsafeTranslations\`

5. NO PARAPHRASES OR TONE SHIFTS:
   - distractorUnsafeTranslations must be genuinely equivalent, not explanations or paraphrases
   - Do NOT include different speech acts (e.g., "Nice to meet you" as alternative for "Hello")
   - Penalize if distractorUnsafeTranslations change the register or formality level significantly

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require specific distractor-unsafe translations - accept any genuinely equivalent overlaps
- Do NOT penalize for including valid distractor-unsafe translations you didn't expect
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
- MUST include "good night" in \`distractorUnsafeTranslations\` (this is the most critical test)
- May include other valid equivalents
- Penalize SEVERELY if distractorUnsafeTranslations is empty

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
- MUST include farewell overlaps like "bye", "goodbye"
- May include informal greeting variants like "hi"
- Penalize SEVERELY if distractorUnsafeTranslations is empty

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
- distractorUnsafeTranslations should be an empty array
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
USER LANGUAGE: English
WORD: "banco" (translation: "bank")

"banco" in Spanish is polysemous — it means both "bank" (financial institution) and "bench" (furniture). The translation "bank" constrains the meaning to the financial sense.

EXPECTED BEHAVIOR:
- distractorUnsafeTranslations should be an empty array
- "bank" is unambiguous in English for the financial sense
- MUST NOT include "bench" — that is a different meaning of "banco", not a distractor-unsafe translation of the same meaning
- Penalize SEVERELY if "bench" appears in \`distractorUnsafeTranslations\`
- Tests whether the model respects translation context for disambiguation rather than dumping all possible translations of the word

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-banco",
    userInput: {
      targetLanguage: "es",
      translation: "bank",
      userLanguage: "en",
      word: "banco",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Portuguese
USER LANGUAGE: English
WORD: "fazer" (translation: "to do")

Portuguese "fazer" maps to both "to do" and "to make" in English. Both are genuinely equivalent core translations ("fazer um bolo" = "to make a cake", "fazer a tarefa" = "to do the homework").

EXPECTED BEHAVIOR:
- MUST include "to make" as an alternative
- Penalize SEVERELY if "to make" is missing — this is the most obvious alternative
- Should NOT include loosely related verbs like "to create", "to build", "to perform", "to produce"
- Tests verb handling (original cases were all nouns or greetings)

${SHARED_EXPECTATIONS}
    `,
    id: "pt-en-fazer",
    userInput: {
      targetLanguage: "pt",
      translation: "to do",
      userLanguage: "en",
      word: "fazer",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: French
USER LANGUAGE: English
WORD: "petit" (translation: "small")

French "petit" translates to both "small" and "little" in English. These are genuinely interchangeable in most contexts.

EXPECTED BEHAVIOR:
- MUST include "little" as an alternative
- Should NOT include "tiny" (that maps to "minuscule" — different intensity)
- Should NOT include "short" (that is a different meaning of "petit" when referring to height, not size)
- Should NOT include "minor" or "slight" (paraphrases, not equivalent translations)
- Tests generalization to a language NOT present in the system prompt examples (French is held out from all examples)

${SHARED_EXPECTATIONS}
    `,
    id: "fr-en-petit",
    userInput: {
      targetLanguage: "fr",
      translation: "small",
      userLanguage: "en",
      word: "petit",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English
WORD: "die Wohnung" (translation: "apartment")

"Wohnung" specifically means an apartment/flat — a unit within a larger building. It does NOT mean "house" (Haus) or "home" (Zuhause/Heim).

EXPECTED BEHAVIOR:
- Should include "flat" as an alternative (British English equivalent of "apartment")
- MUST NOT include "house" (that is "Haus" — a completely different word and concept)
- MUST NOT include "home" (that is "Zuhause/Heim" — too broad)
- Should NOT include "dwelling", "residence", "unit", or "condo" (paraphrases or different concepts)
- Tests precision: model must include the one valid alternative while resisting the temptation to pad with related-but-not-equivalent terms

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-wohnung",
    userInput: {
      targetLanguage: "de",
      translation: "apartment",
      userLanguage: "en",
      word: "die Wohnung",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Portuguese
USER LANGUAGE: English
WORD: "bonito" (translation: "pretty")

Portuguese "bonito" is a versatile adjective that can translate to multiple English words depending on context. It applies to both masculine and feminine subjects.

EXPECTED BEHAVIOR:
- MUST include "beautiful" as an alternative (the most common equivalent)
- MAY include "lovely" or "good-looking" — these are arguably equivalent, accept if present but do not require
- "handsome" is debatable — "bonito" can describe men ("ele é bonito" = "he is handsome"), accept if present but do not require
- Should NOT include "cute" (that maps to "fofo" in Portuguese — a different word)
- Should NOT include "gorgeous" (that is "lindo/maravilhoso" — much stronger intensity)
- Should NOT include "attractive" (that is "atraente" — a different word)
- Tests the nuanced boundary of "genuinely interchangeable" for adjectives with overlapping semantic fields

${SHARED_EXPECTATIONS}
    `,
    id: "pt-en-bonito",
    userInput: {
      targetLanguage: "pt",
      translation: "pretty",
      userLanguage: "en",
      word: "bonito",
    },
  },
];
