const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. TRANSLATION ACCURACY (CRITICAL - highest priority):
   - The translation MUST be a correct dictionary meaning for the word
   - The translation should be contextually appropriate (most common meaning)
   - Penalize SEVERELY if the translation is incorrect or for a different word
   - Accept multiple valid translations (e.g., "eat" or "eats" for a verb)
   - Do NOT require exact wording - accept synonyms that convey the same meaning

2. FUNCTION WORD HANDLING:
   - Articles (the, a), prepositions (in, on), conjunctions (and, but), and particles MUST still receive translations
   - Do NOT penalize for translating function words as function words (e.g., "el" → "the" is correct)
   - Function words may have multiple valid translations depending on context

3. BREVITY:
   - Translations should be concise: one or two words maximum
   - Do NOT provide full definitions or explanations
   - Penalize if the translation is a sentence or long phrase instead of a word

4. NO HALLUCINATION:
   - The output should contain only the translation field
   - The translation must correspond to the actual input word, not a related or similar word
   - Do NOT penalize for minor formatting differences

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact translations - accept any valid dictionary meaning
- Do NOT penalize for choosing one valid translation over another
- FOCUS ON: translation accuracy, brevity
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English

WORD: "el"

This is a Spanish definite article (masculine singular):
- Most common translation: "the"
- This is a function word that must still receive a translation

QUALITY CHECK:
- Should translate to "the" or equivalent
- Should NOT be null or empty
- Tests handling of function words (articles)

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-el",
    userInput: {
      targetLanguage: "es",
      userLanguage: "en",
      word: "el",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English

WORD: "gato"

This is a common Spanish noun meaning "cat":
- Clear, unambiguous translation
- Simple content word

QUALITY CHECK:
- Should translate to "cat"
- Tests basic noun translation

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-gato",
    userInput: {
      targetLanguage: "es",
      userLanguage: "en",
      word: "gato",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English

WORD: "come"

This is a Spanish verb meaning "eats" or "eat" (third person singular present):
- Valid translations: "eats", "eat", "he/she eats"
- Accept any of these forms

QUALITY CHECK:
- Should translate to "eats" or "eat"
- Tests verb translation

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-come",
    userInput: {
      targetLanguage: "es",
      userLanguage: "en",
      word: "come",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Japanese
USER LANGUAGE: English

WORD: "猫"

This is a Japanese word meaning "cat":
- Clear, unambiguous translation
- Uses kanji (non-Roman script)

QUALITY CHECK:
- Should translate to "cat"
- Tests non-Roman script word translation

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-neko",
    userInput: {
      targetLanguage: "ja",
      userLanguage: "en",
      word: "猫",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Japanese
USER LANGUAGE: English

WORD: "食べる"

This is a Japanese verb meaning "to eat":
- Valid translations: "eat", "to eat"
- Uses hiragana and kanji (non-Roman script)

QUALITY CHECK:
- Should translate to "eat" or "to eat"
- Tests verb translation from non-Roman script

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-taberu",
    userInput: {
      targetLanguage: "ja",
      userLanguage: "en",
      word: "食べる",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Japanese
USER LANGUAGE: English

WORD: "は"

This is a Japanese particle used as a topic marker:
- Valid translations: varies by context, but common equivalents include "as for" or simply marking it as a topic particle
- This is a function word that must still receive a translation
- Accept any reasonable translation that conveys its grammatical role

QUALITY CHECK:
- Should provide some translation (even if approximate like "as for" or "topic marker")
- Tests function word handling in non-Roman scripts

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-wa",
    userInput: {
      targetLanguage: "ja",
      userLanguage: "en",
      word: "は",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English

WORD: "der"

This is a German definite article (masculine nominative):
- Most common translation: "the"
- This is a function word that must still receive a translation

QUALITY CHECK:
- Should translate to "the"
- Tests function word handling (gendered articles)

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-der",
    userInput: {
      targetLanguage: "de",
      userLanguage: "en",
      word: "der",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English

WORD: "Hund"

This is a common German noun meaning "dog":
- Clear, unambiguous translation
- Simple content word

QUALITY CHECK:
- Should translate to "dog"
- Tests basic noun translation from German

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-hund",
    userInput: {
      targetLanguage: "de",
      userLanguage: "en",
      word: "Hund",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English

WORD: "läuft"

This is a German verb meaning "runs" or "walks" (third person singular present of "laufen"):
- Valid translations: "runs", "walks", "is running", "is walking"
- Contains umlaut (ä) which is standard in German Roman script

QUALITY CHECK:
- Should translate to "runs" or "walks" (or similar valid form)
- Tests handling of words with umlauts
- Tests verb translation

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-laeuft",
    userInput: {
      targetLanguage: "de",
      userLanguage: "en",
      word: "läuft",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean
USER LANGUAGE: Portuguese

WORD: "고양이"

This is a Korean word meaning "cat" (gato in Portuguese):
- Uses Hangul (non-Roman script)
- Output should be in Portuguese, not English

QUALITY CHECK:
- Should translate to "gato" (Portuguese for "cat")
- Tests non-English output language

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-goyangi",
    userInput: {
      targetLanguage: "ko",
      userLanguage: "pt",
      word: "고양이",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean
USER LANGUAGE: Portuguese

WORD: "는"

This is a Korean topic-marking particle:
- Similar to Japanese "は" in function
- Output should be in Portuguese
- Accept any reasonable translation of this grammatical particle

QUALITY CHECK:
- Should provide a Portuguese translation or grammatical description
- Tests function word handling with non-English output

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-neun",
    userInput: {
      targetLanguage: "ko",
      userLanguage: "pt",
      word: "는",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Korean
USER LANGUAGE: Portuguese

WORD: "먹다"

This is a Korean verb meaning "to eat" (comer in Portuguese):
- Basic verb in dictionary form
- Output should be in Portuguese

QUALITY CHECK:
- Should translate to "comer" (Portuguese for "to eat")
- Tests verb translation with non-English output

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-meokda",
    userInput: {
      targetLanguage: "ko",
      userLanguage: "pt",
      word: "먹다",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Arabic
USER LANGUAGE: Spanish

WORD: "قطة"

This is an Arabic word meaning "cat" (gato/gata in Spanish):
- Uses Arabic script (RTL, non-Roman)
- Output should be in Spanish

QUALITY CHECK:
- Should translate to "gato" or "gata" (Spanish for "cat")
- Tests RTL script with Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-qitta",
    userInput: {
      targetLanguage: "ar",
      userLanguage: "es",
      word: "قطة",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Arabic
USER LANGUAGE: Spanish

WORD: "في"

This is an Arabic preposition meaning "in" (en in Spanish):
- Common function word (preposition)
- Output should be in Spanish

QUALITY CHECK:
- Should translate to "en" (Spanish for "in")
- Tests function word handling with RTL script and Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-fi",
    userInput: {
      targetLanguage: "ar",
      userLanguage: "es",
      word: "في",
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Arabic
USER LANGUAGE: Spanish

WORD: "البيت"

This is an Arabic word meaning "the house" (la casa in Spanish):
- Contains the definite article "ال" (al-) attached to the noun
- Output should be in Spanish

QUALITY CHECK:
- Should translate to "la casa" or "casa" or "el hogar" (Spanish for "the house" or "house")
- Tests handling of attached articles in Arabic with Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-albayt",
    userInput: {
      targetLanguage: "ar",
      userLanguage: "es",
      word: "البيت",
    },
  },
];
