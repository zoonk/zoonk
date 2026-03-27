const SHARED_EXPECTATIONS = `
CONTEXT: distractorUnsafeTranslations are used only to prevent semantically equivalent words from appearing as distractors (wrong answer options) in exercises. For example, in an arrange-words activity where the learner translates "oi, boa noite" ("hi, good evening"), we show individual word tokens alongside distractor words. Without distractorUnsafeTranslations, "good night" could appear as a distractor even though it is also a valid translation of "boa noite". Marking it here excludes it from the distractor pool so learners never see a correct option presented as wrong.

IMPORTANT PRODUCT PRINCIPLE:
- These strings only HIDE distractors. They do not create accepted answers.
- Missing a genuinely confusing overlap is worse than including an extra blocker.
- Slight overblocking is acceptable if it simply removes more distractors.

EVALUATION CRITERIA:

1. COMPLETENESS (CRITICAL - highest priority):
   - The model should include obvious overlaps that could make a wrong option feel unfair or confusing
   - Missing a real overlap is the main failure mode for this task
   - Kinship synonyms should be included when they are natural and common

2. SAFE OVERBLOCKING IS ACCEPTABLE:
   - Do NOT penalize extra short learner-language items just because they are broader, different-sense, or slightly loose
   - Do NOT penalize outputs for being a bit inclusive if they would only suppress more distractors
   - Penalize only if extras make the output unusable, such as wrong-language content, long explanations, or obviously malformed items

3. EMPTY ARRAY WHEN APPROPRIATE:
   - Words with no obvious overlap may return an empty array
   - Do NOT require an empty array if the model chooses to block extra plausible distractors
   - For this task, a non-empty array is not a problem by itself

4. BIDIRECTIONAL SYNONYMS:
   - Consider synonyms in both directions
   - If the user language has multiple words mapping to the same target word, list them
   - Example: Italian "ciao" means both "hello" and "bye" - both should appear in \`distractorUnsafeTranslations\`

5. LANGUAGE AND FORMAT:
   - All items must be in the learner's language
   - Items should be short words or short phrases, not dictionary definitions or long explanations
   - Penalize if languages are mixed incorrectly or the output stops being usable for distractor filtering

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT penalize extra blockers like "bench" or "cute" if they would only hide more distractors
- Do NOT optimize for dictionary purity or sense-perfect precision
- Do NOT require exact emptiness when the output is otherwise usable
- FOCUS ON: missing confusing overlaps, correct language, and short natural strings
`;

export const TEST_CASES = [
  {
    expectations: `
For "boa noite" with canonical translation "good evening":

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
For "ciao" with canonical translation "hello":

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
For "der Papa" with canonical translation "o papai":

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
For "Guten Tag" with canonical translation "boa tarde":

EXPECTED BEHAVIOR:
- MUST include "bom dia" in \`distractorUnsafeTranslations\`
- Output must be in Portuguese, not English or German
- Penalize SEVERELY if "bom dia" is missing

${SHARED_EXPECTATIONS}
    `,
    id: "de-pt-guten-tag",
    userInput: {
      targetLanguage: "de",
      translation: "boa tarde",
      userLanguage: "pt",
      word: "Guten Tag",
    },
  },
  {
    expectations: `
For "猫" with canonical translation "cat":

EXPECTED BEHAVIOR:
- An empty array is perfectly acceptable
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
For "banco" with canonical translation "bank":

EXPECTED BEHAVIOR:
- An empty array is acceptable here because there is no obvious required overlap
- Tests that the evaluator does not over-penalize safe overblocking for this feature

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
For "fazer" with canonical translation "to do":

EXPECTED BEHAVIOR:
- MUST include "to make" as an alternative
- Penalize SEVERELY if "to make" is missing — this is the most obvious alternative
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
For "petit" with canonical translation "small":

EXPECTED BEHAVIOR:
- MUST include "little" as an alternative
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
For "die Wohnung" with canonical translation "apartment":

EXPECTED BEHAVIOR:
- Should include "flat" as an alternative (British English equivalent of "apartment")
- Tests that the model still catches the obvious overlap

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
For "bonito" with canonical translation "pretty":

EXPECTED BEHAVIOR:
- MUST include "beautiful" as an alternative (the most common equivalent)
- MAY include "lovely" or "good-looking" — these are arguably equivalent, accept if present but do not require
- "handsome" is debatable — "bonito" can describe men ("ele é bonito" = "he is handsome"), accept if present but do not require
- Tests that the model catches the main obvious overlap without over-penalizing inclusive outputs

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
