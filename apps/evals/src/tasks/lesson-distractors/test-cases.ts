import { type TestCase } from "@/lib/types";
import { type LessonDistractorsParams } from "@zoonk/ai/tasks/lessons/language/distractors";

const SHARED_EXPECTATIONS = `
CONTEXT: distractors are shown to learners as wrong answer options in translation, reading, and listening lessons.

The most important rule is safety:
- A distractor must never also be a plausible correct answer.
- Polysemous, synonymic, near-equivalent, or alternative-reading distractors are hard failures.
- Nearby expressions are good when they help test the distinction and are still clearly wrong for the exact input.

EVALUATION CRITERIA:

1. SAFETY (CRITICAL - highest priority):
   - Penalize SEVERELY if any distractor could still be accepted by a human teacher as "basically correct"
   - Penalize alternative answers, near-equivalent expressions, polysemous overlaps, synonym overlaps, and alternative readings
   - Do NOT reject nearby greetings or nearby categories automatically when they are still clearly wrong for the exact input

2. SAME LANGUAGE ONLY:
   - Every distractor must stay in the source language
   - Penalize translations, mixed-language output, or romanized output for non-Roman scripts

3. NON-ROMAN SCRIPT SAFETY:
   - For Japanese, Chinese, Korean, and similar scripts, keep distractors in the original script
   - Penalize romanized output like romaji, pinyin, or hangul transliterations written in Latin letters

4. CLEAN OUTPUT:
   - Penalize duplicates, punctuation-only variants, casing-only variants, and repetitions of the source input

ANTI-CHECKLIST GUIDANCE:
- Do NOT require a specific semantic category if the distractors are clearly safe and plausible
- Do NOT reward "clever" distractors if they introduce ambiguity
- FOCUS ON: safety, correct language/script, and clean output
`;

const SINGLE_WORD_EXPECTATIONS = `
ONE WORD ONLY:
- For single-word mode, every distractor must be exactly one word
- Penalize phrases, rewrites, clauses, explanations, or multi-word options
`;

const ANY_SHAPE_EXPECTATIONS = `
ANY SHAPE:
- This test case uses shape "any", so distractors may be one word or multi-word phrases.
- Do NOT penalize multi-word options when they are safe, natural, and in the correct language.
`;

export const TEST_CASES: TestCase<unknown, LessonDistractorsParams>[] = [
  {
    expectations: `
EXPECTED BEHAVIOR:
- Do NOT return near-equivalent alternatives like "salve" or farewell uses like "arrivederci"
- Nearby greetings like "buongiorno" or "buonasera" can be good distractors if they are still clearly wrong for "ciao"
- Distractors may be one word or phrases, but they must stay in Italian

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "it-ciao-polysemy",
    userInput: {
      input: "ciao",
      language: "it",
      shape: "any",
      translation: { language: "en", text: "hello" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Distractors can be phrases like "boa tarde" or "bom dia"
- Do NOT return fragments like "boa"
- "boa noite" means "good evening" AND "good night" — it is polysemous between these two senses. Reject only distractors that specifically mean "good evening" or "good night"
- General greetings like "olá" (hello) are valid distractors — "boa noite" does NOT mean "hello"
- Generic farewells like "até logo" (see you soon) are valid distractors — "see you soon" is NOT a meaning of "boa noite"
- Social formulas like "bem-vindo" (welcome) are valid distractors — "welcome" is NOT a meaning of "boa noite"
- Reject only items that could still be accepted as another way to say the same thing
- Do NOT return English translations

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "pt-boa-noite-greeting",
    userInput: {
      input: "boa noite",
      language: "pt",
      shape: "any",
      translation: { language: "en", text: "Good evening" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- This output is used as English options for a Portuguese learner who sees the prompt "Boa noite"
- Do NOT return "Good night" because "Boa noite" can mean both "Good evening" and "Good night"; both would be valid learner answers without extra context
- Do NOT return near-equivalent evening/night greetings that a teacher could accept for the same Portuguese prompt
- Safe distractors can be other greetings or social phrases that are clearly wrong for "Boa noite", such as "Good morning", "Good afternoon", "Thank you", or "Excuse me"
- Every distractor must stay in English

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "en-good-evening-pt-boa-noite-prompt",
    userInput: {
      input: "Good evening",
      language: "en",
      shape: "any",
      translation: { language: "pt", text: "Boa noite" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- This output is used as Italian options for a Portuguese learner who sees the prompt "Boa noite"
- Do NOT return "buonanotte" because "boa noite" can mean both "buonasera" and "buonanotte"; both would be valid learner answers without extra context
- Do NOT return near-equivalent evening/night greetings that a teacher could accept for the same Portuguese prompt
- Safe distractors can be other Italian greetings or social phrases that are clearly wrong for "Boa noite", such as "buongiorno", "buon pomeriggio", "grazie", or "scusa"
- Every distractor must stay in Italian

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "it-buonasera-pt-boa-noite-prompt",
    userInput: {
      input: "buonasera",
      language: "it",
      shape: "any",
      translation: { language: "pt", text: "Boa noite" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- The learner-visible prompt is Portuguese "banco", which can mean both "bank" and "bench"
- Do NOT return "bench" because it could also be accepted as a valid translation of "banco" without extra context
- Do NOT return near-equivalent financial institution terms that a teacher could accept for the same prompt
- Safe distractors can be finance-adjacent or place-adjacent English words that are clearly wrong for "banco", such as "wallet", "store", "office", or "chair"
- Every distractor must stay in English

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "en-bank-pt-banco-prompt",
    userInput: {
      input: "bank",
      language: "en",
      shape: "any",
      translation: { language: "pt", text: "banco" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- The learner-visible prompt is Portuguese "dinheiro", so reject English candidates that could be accepted as "money" or "dinheiro"
- Do NOT return synonyms or near-synonyms like "cash", "funds", or "currency" that could still be accepted as correct
- Finance-adjacent words like "bank" are valid when they are clearly not translations of "dinheiro"
- Prefer clearly wrong English output from the same broad finance/payment domain

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "en-money-polysemy",
    userInput: {
      input: "money",
      language: "en",
      shape: "any",
      translation: { language: "pt", text: "dinheiro" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Sentence input still requires one-word distractors only
- Do NOT return phrases like "Guten Tag"
- Do NOT return punctuation-only variants
- "Guten Morgen" is NOT polysemous — it only means "good morning", never "goodbye". So farewell words like "Tschüss" are valid distractors (clearly wrong, no overlap). Do NOT penalize nearby greetings/farewells that are still clearly wrong for this input

${SHARED_EXPECTATIONS}
${SINGLE_WORD_EXPECTATIONS}
    `,
    id: "de-sentence-one-word-only",
    userInput: {
      input: "Guten Morgen, Anna!",
      language: "de",
      shape: "single-word",
      translation: { language: "en", text: "Good morning, Anna!" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- All distractors must stay in Japanese script
- Do NOT output romaji like "inu" or "neko"

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "ja-non-roman",
    userInput: {
      input: "猫",
      language: "ja",
      shape: "any",
      translation: { language: "en", text: "cat" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- All distractors must stay in Hangul
- Do NOT output Latin-script romanizations

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "ko-non-roman",
    userInput: {
      input: "학교",
      language: "ko",
      shape: "any",
      translation: { language: "en", text: "school" },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Sentence input still requires one-word distractors only
- All distractors must stay in Chinese script
- Do NOT output pinyin or English

${SHARED_EXPECTATIONS}
${SINGLE_WORD_EXPECTATIONS}
    `,
    id: "zh-sentence-non-roman",
    userInput: {
      input: "我喜欢咖啡。",
      language: "zh",
      shape: "single-word",
      translation: { language: "en", text: "I like coffee." },
    },
  },
  {
    expectations: `
EXPECTED BEHAVIOR:
- Do NOT return English items like "small" or "little"
- Do NOT return duplicates or formatting variants

${SHARED_EXPECTATIONS}
${ANY_SHAPE_EXPECTATIONS}
    `,
    id: "fr-clean-output",
    userInput: {
      input: "petit",
      language: "fr",
      shape: "any",
      translation: { language: "en", text: "small" },
    },
  },
];
