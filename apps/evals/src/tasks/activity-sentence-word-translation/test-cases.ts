const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. TRANSLATION ACCURACY (CRITICAL - highest priority):
   - The translation MUST be a correct dictionary meaning for the word
   - The translation should be contextually appropriate (most common meaning)
   - Penalize SEVERELY if the translation is incorrect or for a different word
   - Accept multiple valid translations (e.g., "eat" or "eats" for a verb)
   - Do NOT require exact wording - accept synonyms that convey the same meaning

2. ROMANIZATION CORRECTNESS (CRITICAL):
   - For Roman script languages (Spanish, German, English, Portuguese, French, Italian, etc.): romanization MUST be null
   - For non-Roman script languages (Japanese, Korean, Arabic, Chinese, Russian, Hindi, Thai, etc.): romanization MUST NOT be null
   - Romanization should follow standard systems (Hepburn for Japanese, Revised Romanization for Korean, etc.)
   - Penalize SEVERELY if romanization is provided for Roman script words or missing for non-Roman script words

3. FUNCTION WORD HANDLING:
   - Articles (the, a), prepositions (in, on), conjunctions (and, but), and particles MUST still receive translations
   - Do NOT penalize for translating function words as function words (e.g., "el" → "the" is correct)
   - Function words may have multiple valid translations depending on context

4. BREVITY:
   - Translations should be concise: one or two words maximum
   - Do NOT provide full definitions or explanations
   - Penalize if the translation is a sentence or long phrase instead of a word

5. NO HALLUCINATION:
   - The output should contain only the two required fields: translation and romanization
   - The translation must correspond to the actual input word, not a related or similar word
   - Do NOT penalize for minor formatting differences

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact translations - accept any valid dictionary meaning
- Do NOT penalize for choosing one valid translation over another
- Different valid romanization styles exist - assess whether the chosen one is reasonable
- FOCUS ON: translation accuracy, romanization correctness (null vs non-null), brevity
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

ROMANIZATION CHECK:
- Spanish uses Roman script
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "the" or equivalent
- Should NOT be null or empty
- Tests handling of function words (articles)

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-el",
    userInput: {
      targetLanguage: "Spanish",
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

ROMANIZATION CHECK:
- Spanish uses Roman script
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "cat"
- Tests basic noun translation

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-gato",
    userInput: {
      targetLanguage: "Spanish",
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

ROMANIZATION CHECK:
- Spanish uses Roman script
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "eats" or "eat"
- Tests verb translation

${SHARED_EXPECTATIONS}
    `,
    id: "es-en-come",
    userInput: {
      targetLanguage: "Spanish",
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

ROMANIZATION CHECK:
- Japanese uses non-Roman script (kanji/hiragana/katakana)
- Romanization MUST NOT be null
- Expected romanization: "neko" (Hepburn system)

QUALITY CHECK:
- Should translate to "cat"
- Romanization should be "neko" or a reasonable variant
- Tests non-Roman script handling with romanization

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-neko",
    userInput: {
      targetLanguage: "Japanese",
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

ROMANIZATION CHECK:
- Japanese uses non-Roman script
- Romanization MUST NOT be null
- Expected romanization: "taberu" (Hepburn system)

QUALITY CHECK:
- Should translate to "eat" or "to eat"
- Romanization should be "taberu" or a reasonable variant
- Tests verb translation with romanization

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-taberu",
    userInput: {
      targetLanguage: "Japanese",
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

ROMANIZATION CHECK:
- Japanese uses non-Roman script
- Romanization MUST NOT be null
- Expected romanization: "wa" (when used as particle, pronounced "wa" not "ha")

QUALITY CHECK:
- Should provide some translation (even if approximate like "as for" or "topic marker")
- Romanization should be "wa" (particle pronunciation)
- Tests function word handling in non-Roman scripts

${SHARED_EXPECTATIONS}
    `,
    id: "ja-en-wa",
    userInput: {
      targetLanguage: "Japanese",
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

ROMANIZATION CHECK:
- German uses Roman script
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "the"
- Tests function word handling (gendered articles)

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-der",
    userInput: {
      targetLanguage: "German",
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

ROMANIZATION CHECK:
- German uses Roman script
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "dog"
- Tests basic noun translation from German

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-hund",
    userInput: {
      targetLanguage: "German",
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

ROMANIZATION CHECK:
- German uses Roman script (umlauts are part of German alphabet)
- Romanization MUST be null

QUALITY CHECK:
- Should translate to "runs" or "walks" (or similar valid form)
- Tests handling of words with umlauts
- Tests verb translation

${SHARED_EXPECTATIONS}
    `,
    id: "de-en-laeuft",
    userInput: {
      targetLanguage: "German",
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

ROMANIZATION CHECK:
- Korean uses non-Roman script (Hangul)
- Romanization MUST NOT be null
- Expected romanization: "goyangi" (Revised Romanization of Korean)

QUALITY CHECK:
- Should translate to "gato" (Portuguese for "cat")
- Romanization should be "goyangi" or a reasonable variant
- Tests non-English output language with romanization

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-goyangi",
    userInput: {
      targetLanguage: "Korean",
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

ROMANIZATION CHECK:
- Korean uses non-Roman script (Hangul)
- Romanization MUST NOT be null
- Expected romanization: "neun" (Revised Romanization)

QUALITY CHECK:
- Should provide a Portuguese translation or grammatical description
- Romanization should be "neun" or a reasonable variant
- Tests function word handling with non-English output

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-neun",
    userInput: {
      targetLanguage: "Korean",
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

ROMANIZATION CHECK:
- Korean uses non-Roman script (Hangul)
- Romanization MUST NOT be null
- Expected romanization: "meokda" or "meoktta" (Revised Romanization)

QUALITY CHECK:
- Should translate to "comer" (Portuguese for "to eat")
- Romanization should follow Revised Romanization system
- Tests verb translation with non-English output

${SHARED_EXPECTATIONS}
    `,
    id: "ko-pt-meokda",
    userInput: {
      targetLanguage: "Korean",
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

ROMANIZATION CHECK:
- Arabic uses non-Roman script
- Romanization MUST NOT be null
- Expected romanization: "qitta" or "qittah" or similar

QUALITY CHECK:
- Should translate to "gato" or "gata" (Spanish for "cat")
- Romanization should be a reasonable Arabic romanization
- Tests RTL script with Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-qitta",
    userInput: {
      targetLanguage: "Arabic",
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

ROMANIZATION CHECK:
- Arabic uses non-Roman script
- Romanization MUST NOT be null
- Expected romanization: "fi" or "fii"

QUALITY CHECK:
- Should translate to "en" (Spanish for "in")
- Tests function word handling with RTL script and Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-fi",
    userInput: {
      targetLanguage: "Arabic",
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

ROMANIZATION CHECK:
- Arabic uses non-Roman script
- Romanization MUST NOT be null
- Expected romanization: "al-bayt" or "albayt" or similar

QUALITY CHECK:
- Should translate to "la casa" or "casa" or "el hogar" (Spanish for "the house" or "house")
- Romanization should include the "al-" prefix
- Tests handling of attached articles in Arabic with Spanish output

${SHARED_EXPECTATIONS}
    `,
    id: "ar-es-albayt",
    userInput: {
      targetLanguage: "Arabic",
      userLanguage: "es",
      word: "البيت",
    },
  },
];
