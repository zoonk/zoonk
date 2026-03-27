const SHARED_EXPECTATIONS = `
CONTEXT: This task predicts which full-sentence variants would make distractors misleading. These variants are used only for distractor filtering, not answer validation. The decision test is: "If we showed this as a distractor, would it confuse a learner because it still expresses the same meaning?"

EVALUATION CRITERIA:

1. COMPLETENESS (CRITICAL - highest priority):
   - The model must catch variants that would create misleading distractors
   - Penalize if the model misses obvious overlaps (greeting overlaps, pronoun drops, contractions, aspect-equivalent forms, kinship synonyms)
   - Missing one of these variants means the app can surface a confusing distractor

2. NO INVENTED VARIANTS:
   - Penalize if the model includes paraphrases that change the core meaning
   - Penalize if the model includes variants that significantly shift formality or register (e.g., "Hello" → "Hey")
   - Do NOT penalize for borderline-valid synonyms that would still confuse learners if shown as distractors

3. CORRECT DIRECTION:
   - \`distractorUnsafeSentences\` must be in TARGET_LANGUAGE
   - \`distractorUnsafeTranslations\` must be in USER_LANGUAGE
   - Penalize if the languages are swapped or mixed

4. NO CANONICAL DUPLICATES:
   - The canonical sentence or translation must not appear again in the distractor-unsafe arrays

5. NO PUNCTUATION-ONLY OR CASING-ONLY VARIANTS:
   - The app already ignores punctuation and case

6. NO TRANSITIVE OVERLAP:
   - Penalize if the model uses translation overlap transitively
   - Accept directional asymmetry when only one side has a valid alternative

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require exact wording if a variant would genuinely confuse learners as a distractor
- Do NOT penalize for keeping the canonical answer narrow — this task is about distractor filtering, not answer acceptance
- Do NOT penalize for including kinship synonyms (Mom/Mama/Momma/Mommy, Dad/Daddy/Papa) when they refer to the same person
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
- The model may include "Guten Tag, Anna!" in \`distractorUnsafeSentences\` from general linguistic knowledge (both "Guten Morgen" and "Guten Tag" can mean "Bom dia"). Do NOT penalize for including or omitting it.
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
- The model may include "Guten Abend, Mama." in \`distractorUnsafeSentences\` from general linguistic knowledge (both "Gute Nacht" and "Guten Abend" can mean "Boa noite"). Do NOT penalize for including or omitting it.
- \`distractorUnsafeTranslations\` may include kinship synonyms like "Boa noite, mamãe." or "Boa noite, mãezinha." because those would also be misleading distractors. Do NOT penalize for including these.

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
- \`distractorUnsafeSentences\` should stay empty — do NOT include "Guten Morgen, Herr Weber." (transitive overlap is invalid)
- The model may include "Bom dia, senhor Weber." in \`distractorUnsafeTranslations\` from general linguistic knowledge ("Guten Tag" can also mean "Bom dia"). Do NOT penalize for including or omitting it.
- \`distractorUnsafeTranslations\` may include variants with "seu" instead of "senhor" (e.g., "Boa tarde, seu Weber.") because "seu" is a common informal form of "senhor" in Brazilian Portuguese and would still be a misleading distractor. Do NOT penalize for including these.
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
- \`distractorUnsafeSentences\` should include "Soy Lara."
- \`distractorUnsafeTranslations\` should include "I'm Lara."
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
- \`distractorUnsafeTranslations\` should include "The cat is sleeping." — both "sleeps" and "is sleeping" are valid English translations of the present-tense Spanish verb "duerme"
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
- Do NOT include "Oi, eu sou Lara." or "Olá, eu sou Lara." in \`distractorUnsafeTranslations\` — "Bom dia" carries time-of-day meaning that "Oi"/"Olá" drop entirely, so this is a meaning change, not just a register shift
- \`distractorUnsafeTranslations\` may include "Boa tarde, eu sou Lara." or "Boa tarde, sou Lara." — "Guten Tag" genuinely means both "Bom dia" and "Boa tarde" in Portuguese, so these are valid time-of-day greeting overlaps. Do NOT penalize for including these.
- \`distractorUnsafeSentences\` may include pronoun-drop variants. Do NOT penalize for including them.

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
- Do NOT include "Gute Nacht Mama." as a distractor-unsafe sentence (punctuation-only variant)
- Do NOT include punctuation-only variants in either array
- \`distractorUnsafeTranslations\` should include common kinship synonyms like "Good night, Mama.", "Good night, Momma.", or "Good night, Mommy." because those would all be misleading distractors
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
