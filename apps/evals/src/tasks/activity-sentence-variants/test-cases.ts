const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. STRICT EQUIVALENCE (CRITICAL - highest priority):
   - Variants must preserve the same meaning and register as the canonical pair
   - Penalize SEVERELY if the model includes paraphrases, looser restatements, or tone shifts
   - Accept multiple correct equivalents only when a native teacher would genuinely accept them without extra context

2. CORRECT DIRECTION:
   - \`alternativeSentences\` must be in TARGET_LANGUAGE
   - \`alternativeTranslations\` must be in USER_LANGUAGE
   - Penalize if the languages are swapped or mixed

3. NO CANONICAL DUPLICATES:
   - The canonical sentence or translation must not appear again in the alternative arrays
   - Penalize if duplicates or near-duplicates are returned

4. NO PUNCTUATION-ONLY OR CASING-ONLY VARIANTS:
   - Penalize if the model includes variants that only remove commas, add exclamation marks, or change capitalization
   - The app already ignores punctuation and case

5. EMPTY ARRAYS WHEN UNAMBIGUOUS:
   - If the pair is clearly unambiguous, both arrays should be empty
   - Penalize if the model invents unnecessary variants

6. VOCABULARY HINT USAGE:
   - Use lesson vocabulary as a clue for likely ambiguity
   - Penalize if the model ignores obvious ambiguity that the vocabulary hints make clear
   - Penalize if it overuses vocabulary hints to justify unnatural sentence-level variants

7. NON-TRANSITIVE OVERLAP:
   - Penalize if the model uses vocabulary overlap transitively
   - Accept directional asymmetry when only one side has a valid alternative
   - Penalize invalid target-language swaps like turning "Boa tarde" into "Guten Morgen"

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact wording if a variant is genuinely equivalent
- Do NOT penalize for choosing one acceptable canonical answer over another
- FOCUS ON: strict equivalence, ambiguity detection, correct language direction, and avoiding fake variants
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Guten Morgen, Anna!"
- translation: "Bom dia, Anna!"

VOCABULARY HINTS:
- "Guten Morgen" -> "Bom dia"
- "Guten Tag" -> "Boa tarde", alternative translation: "Bom dia"

EXPECTED BEHAVIOR:
- \`alternativeSentences\` should include "Guten Tag, Anna!"
- \`alternativeTranslations\` should stay empty
- Penalize if the model misses the accepted German greeting variant

${SHARED_EXPECTATIONS}
    `,
    id: "pt-de-bom-dia-greeting",
    userInput: {
      chapterTitle: "Saudações básicas",
      lessonDescription: "Cumprimente pessoas em diferentes momentos do dia.",
      lessonTitle: "Saudações",
      sentences: [
        {
          id: "0",
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
      ],
      targetLanguage: "de",
      userLanguage: "pt",
      words: [
        {
          alternativeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          alternativeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Gute Nacht, Mama."
- translation: "Boa noite, mãe."

VOCABULARY HINTS:
- "Guten Abend" -> "Boa noite"
- "Gute Nacht" -> "Boa noite"

EXPECTED BEHAVIOR:
- \`alternativeSentences\` should include "Guten Abend, Mama."
- \`alternativeTranslations\` should stay empty
- Penalize if the model forces only one German interpretation for a context-free "Boa noite" prompt

${SHARED_EXPECTATIONS}
    `,
    id: "pt-de-boa-noite-greeting",
    userInput: {
      chapterTitle: "Saudações básicas",
      lessonDescription: "Use cumprimentos em situações cotidianas.",
      lessonTitle: "Saudações",
      sentences: [
        {
          id: "0",
          sentence: "Gute Nacht, Mama.",
          translation: "Boa noite, mãe.",
        },
      ],
      targetLanguage: "de",
      userLanguage: "pt",
      words: [
        {
          alternativeTranslations: [],
          translation: "Boa noite",
          word: "Guten Abend",
        },
        {
          alternativeTranslations: [],
          translation: "Boa noite",
          word: "Gute Nacht",
        },
        {
          alternativeTranslations: [],
          translation: "mãe",
          word: "Mama",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Guten Tag, Herr Weber."
- translation: "Boa tarde, senhor Weber."

VOCABULARY HINTS:
- "Guten Morgen" -> "Bom dia"
- "Guten Tag" -> "Boa tarde", alternative translation: "Bom dia"

EXPECTED BEHAVIOR:
- \`alternativeSentences\` should stay empty
- \`alternativeTranslations\` should include "Bom dia, senhor Weber."
- Do NOT include "Guten Morgen, Herr Weber."
- Penalize if the model treats translation overlap transitively

${SHARED_EXPECTATIONS}
    `,
    id: "pt-de-boa-tarde-nontransitive-overlap",
    userInput: {
      chapterTitle: "Cumprimentos iniciais",
      lessonDescription: "Cumprimente pessoas em momentos diferentes do dia.",
      lessonTitle: "Saudações formais",
      sentences: [
        {
          id: "0",
          sentence: "Guten Tag, Herr Weber.",
          translation: "Boa tarde, senhor Weber.",
        },
      ],
      targetLanguage: "de",
      userLanguage: "pt",
      words: [
        {
          alternativeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          alternativeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English

CANONICAL PAIR:
- sentence: "Yo soy Lara."
- translation: "I am Lara."

EXPECTED BEHAVIOR:
- \`alternativeSentences\` should include "Soy Lara."
- \`alternativeTranslations\` should include "I'm Lara."
- Penalize if the model misses optional pronouns or standard contractions

${SHARED_EXPECTATIONS}
    `,
    id: "en-es-pronoun-and-contraction",
    userInput: {
      chapterTitle: "Introductions",
      lessonDescription: "Introduce yourself with very simple sentences.",
      lessonTitle: "Names and Introductions",
      sentences: [
        {
          id: "0",
          sentence: "Yo soy Lara.",
          translation: "I am Lara.",
        },
      ],
      targetLanguage: "es",
      userLanguage: "en",
      words: [
        {
          alternativeTranslations: [],
          translation: "I",
          word: "yo",
        },
        {
          alternativeTranslations: [],
          translation: "am",
          word: "soy",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: Spanish
USER LANGUAGE: English

CANONICAL PAIR:
- sentence: "El gato duerme."
- translation: "The cat sleeps."

EXPECTED BEHAVIOR:
- Both alternative arrays should be empty
- Penalize if the model invents extra variants for this unambiguous sentence

${SHARED_EXPECTATIONS}
    `,
    id: "en-es-unambiguous-sentence",
    userInput: {
      chapterTitle: "Animals",
      lessonDescription: "Learn simple animal sentences.",
      lessonTitle: "Pets",
      sentences: [
        {
          id: "0",
          sentence: "El gato duerme.",
          translation: "The cat sleeps.",
        },
      ],
      targetLanguage: "es",
      userLanguage: "en",
      words: [
        {
          alternativeTranslations: [],
          translation: "the cat",
          word: "el gato",
        },
        {
          alternativeTranslations: [],
          translation: "sleeps",
          word: "duerme",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Guten Tag, ich bin Lara."
- translation: "Bom dia, eu sou Lara."

EXPECTED BEHAVIOR:
- Do NOT include "Oi, eu sou Lara." in \`alternativeTranslations\`
- Do NOT include looser greetings that change register
- Empty arrays are acceptable if no other strict variants are present

${SHARED_EXPECTATIONS}
    `,
    id: "pt-de-register-drift",
    userInput: {
      chapterTitle: "Introduções",
      lessonDescription: "Cumprimentos simples para conhecer alguém.",
      lessonTitle: "Apresentações",
      sentences: [
        {
          id: "0",
          sentence: "Guten Tag, ich bin Lara.",
          translation: "Bom dia, eu sou Lara.",
        },
      ],
      targetLanguage: "de",
      userLanguage: "pt",
      words: [
        {
          alternativeTranslations: [],
          translation: "Bom dia",
          word: "Guten Tag",
        },
        {
          alternativeTranslations: ["Oi"],
          translation: "Olá",
          word: "Hallo",
        },
      ],
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: English

CANONICAL PAIR:
- sentence: "Gute Nacht, Mama."
- translation: "Good night, Mom."

EXPECTED BEHAVIOR:
- Do NOT include "Gute Nacht Mama." as an alternative sentence
- Do NOT include punctuation-only variants in either array
- Empty arrays are acceptable if no other strict variants are justified

${SHARED_EXPECTATIONS}
    `,
    id: "en-de-punctuation-only-variant",
    userInput: {
      chapterTitle: "Family greetings",
      lessonDescription: "Short bedtime and family expressions.",
      lessonTitle: "Bedtime phrases",
      sentences: [
        {
          id: "0",
          sentence: "Gute Nacht, Mama.",
          translation: "Good night, Mom.",
        },
      ],
      targetLanguage: "de",
      userLanguage: "en",
      words: [
        {
          alternativeTranslations: [],
          translation: "good night",
          word: "Gute Nacht",
        },
        {
          alternativeTranslations: [],
          translation: "Mom",
          word: "Mama",
        },
      ],
    },
  },
];
