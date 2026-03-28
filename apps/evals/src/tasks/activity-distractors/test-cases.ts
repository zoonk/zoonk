const SHARED_EXPECTATIONS = `
CONTEXT: distractors are shown to learners as wrong answer options in translation, reading, and listening activities.

The most important rule is safety:
- A distractor must never also be a plausible correct answer.
- Polysemous, synonymic, greeting-overlap, or alternative-reading distractors are hard failures.

EVALUATION CRITERIA:

1. SAFETY (CRITICAL - highest priority):
   - Penalize SEVERELY if any distractor could still be accepted by a human teacher as "basically correct"
   - Penalize greeting overlaps, polysemous overlaps, synonym overlaps, and alternative readings

2. ONE WORD ONLY:
   - For single-word mode, every distractor must be exactly one word
   - Penalize phrases, rewrites, clauses, explanations, or multi-word options

3. SAME LANGUAGE ONLY:
   - Every distractor must stay in the source language
   - Penalize translations, mixed-language output, or romanized output for non-Roman scripts

4. NON-ROMAN SCRIPT SAFETY:
   - For Japanese, Chinese, Korean, and similar scripts, keep distractors in the original script
   - Penalize romanized output like romaji, pinyin, or hangul transliterations written in Latin letters

5. CLEAN OUTPUT:
   - Penalize duplicates, punctuation-only variants, casing-only variants, and repetitions of the source input

ANTI-CHECKLIST GUIDANCE:
- Do NOT require a specific semantic category if the distractors are clearly safe and plausible
- Do NOT reward "clever" distractors if they introduce ambiguity
- FOCUS ON: safety, one-word format, correct script, and clean output
`;

export const TEST_CASES = [
  {
    expectations: `
EXPECTED BEHAVIOR:
- Do NOT return "hello", "bye", or "goodbye" because those can still be correct
- Distractors may be one word or phrases, but they must stay in Italian

${SHARED_EXPECTATIONS}
    `,
    id: "it-ciao-polysemy",
    userInput: {
      input: "ciao",
      language: "it",
      shape: "any",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Distractors can be phrases like "boa tarde" or "bom dia"
- Do NOT return fragments like "boa"
- Do NOT return greeting-overlap distractors that could still be interpreted as correct
- Do NOT return English translations

${SHARED_EXPECTATIONS}
    `,
    id: "pt-boa-noite-greeting",
    userInput: {
      input: "boa noite",
      language: "pt",
      shape: "any",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Do NOT return highly polysemous distractors like "bank", "change", "note", or "bill"
- Do NOT return synonyms like "cash" that could still be accepted as correct
- Prefer clearly wrong English output that is less ambiguous

${SHARED_EXPECTATIONS}
    `,
    id: "en-money-polysemy",
    userInput: {
      input: "money",
      language: "en",
      shape: "any",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Sentence input still requires one-word distractors only
- Do NOT return phrases like "Guten Tag"
- Do NOT return punctuation-only variants

${SHARED_EXPECTATIONS}
    `,
    id: "de-sentence-one-word-only",
    userInput: {
      input: "Guten Morgen, Anna!",
      language: "de",
      shape: "single-word",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- All distractors must stay in Japanese script
- Do NOT output romaji like "inu" or "neko"

${SHARED_EXPECTATIONS}
    `,
    id: "ja-non-roman",
    userInput: {
      input: "猫",
      language: "ja",
      shape: "any",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- All distractors must stay in Hangul
- Do NOT output Latin-script romanizations

${SHARED_EXPECTATIONS}
    `,
    id: "ko-non-roman",
    userInput: {
      input: "학교",
      language: "ko",
      shape: "any",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Sentence input still requires one-word distractors only
- All distractors must stay in Chinese script
- Do NOT output pinyin or English

${SHARED_EXPECTATIONS}
    `,
    id: "zh-sentence-non-roman",
    userInput: {
      input: "我喜欢咖啡。",
      language: "zh",
      shape: "single-word",
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Do NOT return English items like "small" or "little"
- Do NOT return duplicates or formatting variants

${SHARED_EXPECTATIONS}
    `,
    id: "fr-clean-output",
    userInput: {
      input: "petit",
      language: "fr",
      shape: "any",
    },
  },
];
