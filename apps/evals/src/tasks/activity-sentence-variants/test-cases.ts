const SHARED_EXPECTATIONS = `
CONTEXT: This task predicts correct answers learners might give. The primary goal is to avoid telling learners their correct answer is wrong. Missing a valid variant is worse than including a borderline one. The decision test is: "If a learner said this, would I understand what they mean and consider it correct?"

EVALUATION CRITERIA:

1. COMPLETENESS (CRITICAL - highest priority):
   - The model must catch valid variants that a native speaker would understand as correct
   - Penalize if the model misses obvious valid alternatives (greeting overlaps, pronoun drops, contractions, aspect-equivalent forms, kinship synonyms)
   - Missing a valid variant means a learner gets incorrectly told their answer is wrong

2. NO INVENTED VARIANTS:
   - Penalize if the model includes paraphrases that change the core meaning
   - Penalize if the model includes variants that significantly shift formality or register (e.g., "Hello" → "Hey")
   - Do NOT penalize for borderline-valid synonyms that a native speaker would understand

3. CORRECT DIRECTION:
   - \`alternativeSentences\` must be in TARGET_LANGUAGE
   - \`alternativeTranslations\` must be in USER_LANGUAGE
   - Penalize if the languages are swapped or mixed

4. NO CANONICAL DUPLICATES:
   - The canonical sentence or translation must not appear again in the alternative arrays

5. NO PUNCTUATION-ONLY OR CASING-ONLY VARIANTS:
   - The app already ignores punctuation and case

6. NO TRANSITIVE OVERLAP:
   - Penalize if the model uses translation overlap transitively
   - Accept directional asymmetry when only one side has a valid alternative

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact wording if a variant is genuinely equivalent
- Do NOT penalize for choosing one acceptable canonical answer over another
- Do NOT penalize for including kinship synonyms (Mom/Mama/Momma/Mommy, Dad/Daddy/Papa) — if a learner says it, we understand what they mean
- FOCUS ON: completeness, ambiguity detection, correct language direction, and avoiding invented variants
`;

export const TEST_CASES = [
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Guten Morgen, Anna!"
- translation: "Bom dia, Anna!"

EXPECTED BEHAVIOR:
- The model may include "Guten Tag, Anna!" in \`alternativeSentences\` from general linguistic knowledge (both "Guten Morgen" and "Guten Tag" can mean "Bom dia"). Do NOT penalize for including or omitting it.
- Penalize if the model includes invalid variants (e.g., register shifts, punctuation-only changes)

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
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Gute Nacht, Mama."
- translation: "Boa noite, mãe."

EXPECTED BEHAVIOR:
- The model may include "Guten Abend, Mama." in \`alternativeSentences\` from general linguistic knowledge (both "Gute Nacht" and "Guten Abend" can mean "Boa noite"). Do NOT penalize for including or omitting it.
- \`alternativeTranslations\` may include kinship synonyms like "Boa noite, mamãe." or "Boa noite, mãezinha." — if a learner says "mamãe" or "mãezinha" instead of "mãe", we understand they mean the same person. Do NOT penalize for including these.

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
    },
  },
  {
    expectations: `
TARGET LANGUAGE: German
USER LANGUAGE: Brazilian Portuguese

CANONICAL PAIR:
- sentence: "Guten Tag, Herr Weber."
- translation: "Boa tarde, senhor Weber."

EXPECTED BEHAVIOR:
- \`alternativeSentences\` should stay empty — do NOT include "Guten Morgen, Herr Weber." (transitive overlap is invalid)
- The model may include "Bom dia, senhor Weber." in \`alternativeTranslations\` from general linguistic knowledge ("Guten Tag" can also mean "Bom dia"). Do NOT penalize for including or omitting it.
- \`alternativeTranslations\` may include variants with "seu" instead of "senhor" (e.g., "Boa tarde, seu Weber.") — "seu" is a common informal form of "senhor" in Brazilian Portuguese and if a learner says it, we understand what they mean. Do NOT penalize for including these.
- Penalize if the model treats translation overlap transitively (e.g., because "Guten Tag" can mean "Bom dia" and "Guten Morgen" also means "Bom dia", incorrectly concluding "Guten Morgen" is valid for "Boa tarde")

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
- \`alternativeTranslations\` should include "The cat is sleeping." — both "sleeps" and "is sleeping" are valid English translations of the present-tense Spanish verb "duerme"
- Do NOT penalize the model for including this aspect-equivalent variant
- Penalize if the model includes unrelated paraphrases beyond aspect-equivalent forms

${SHARED_EXPECTATIONS}
    `,
    id: "en-es-aspect-variant",
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
- Do NOT include "Oi, eu sou Lara." or "Olá, eu sou Lara." in \`alternativeTranslations\` — "Bom dia" carries time-of-day meaning that "Oi"/"Olá" drop entirely, so this is a meaning change, not just a register shift
- \`alternativeTranslations\` may include "Boa tarde, eu sou Lara." or "Boa tarde, sou Lara." — "Guten Tag" genuinely means both "Bom dia" and "Boa tarde" in Portuguese, so these are valid time-of-day greeting alternatives. Do NOT penalize for including these.
- \`alternativeSentences\` may include pronoun-drop variants. Do NOT penalize for including them.

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
- Do NOT include "Gute Nacht Mama." as an alternative sentence (punctuation-only variant)
- Do NOT include punctuation-only variants in either array
- \`alternativeTranslations\` should include common kinship synonyms like "Good night, Mama.", "Good night, Momma.", or "Good night, Mommy." — these are valid because if a learner says "Mama", "Momma", or "Mommy" instead of "Mom", we understand they mean the same person and their answer is correct
- Do NOT penalize the model for including these kinship-synonym variants

${SHARED_EXPECTATIONS}
    `,
    id: "en-de-kinship-and-punctuation-variant",
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
    },
  },
];
