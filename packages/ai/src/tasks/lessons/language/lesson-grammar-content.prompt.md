# Goal

Create grammar examples and exercises entirely in TARGET_LANGUAGE for a Pattern Discovery lesson. Translations, explanations, and romanization are handled separately — this prompt produces only the monolingual foundation.

Focus on a single grammar point. The examples should make the pattern discoverable without explanation.

# Output Format

Return an object with `examples` (2-4 sentences with highlights) and `exercises` (1-3 fill-in-the-blank items):

```json
{
  "examples": [
    {
      "sentence": "Yo hablo español.",
      "highlight": "hablo"
    },
    {
      "sentence": "Ella habla con su madre.",
      "highlight": "habla"
    },
    {
      "sentence": "Nosotros hablamos mucho.",
      "highlight": "hablamos"
    }
  ],
  "exercises": [
    {
      "template": "Tú [BLANK] muy bien.",
      "answer": "hablas",
      "distractors": ["habla", "hablo", "hablar"]
    },
    {
      "template": "Ellos [BLANK] en la oficina.",
      "answer": "trabajan",
      "distractors": ["trabaja", "trabajo", "trabajar"]
    }
  ]
}
```

**Non-Roman script example (Japanese):**

```json
{
  "examples": [
    { "sentence": "私は学生です。", "highlight": "は" },
    { "sentence": "これは本です。", "highlight": "は" },
    { "sentence": "田中さんは先生です。", "highlight": "は" }
  ],
  "exercises": [
    {
      "template": "猫[BLANK]かわいいです。",
      "answer": "は",
      "distractors": ["が", "を", "に"]
    },
    {
      "template": "あなた[BLANK]だれですか。",
      "answer": "は",
      "distractors": ["が", "を", "の"]
    }
  ]
}
```

# Examples

Provide 2-4 sentences that clearly demonstrate the grammar pattern.

## Design Rules

- The grammar element must be visible in every sentence. For agreement patterns, choose forms where the contrast is obvious (e.g., adjectives with clearly different masculine/feminine forms, not invariable ones)
- Use level-appropriate vocabulary the learner likely knows — focus should stay on grammar, not vocabulary
- Keep sentences short (5-10 words for beginner/intermediate). Longer sentences obscure the pattern
- Sentences should sound natural — things a native speaker would actually say, not textbook constructions
- Vary the content (different subjects, objects, contexts) while keeping the same grammatical structure
- Build progressively: start with the clearest case, then show variations
- For verb conjugation, prefer showing different persons/forms across examples. Avoid regional forms (vosotros, vos) unless the lesson specifically targets them
- Use consistent script choices within an lesson. If examples use kanji for a word, exercises should too

## Highlighting Rules

The `highlight` field isolates the grammatical element being taught. Use a phrase (multiple words) when the grammar concept involves relationships between elements:

- For verb conjugations: highlight the verb form (e.g., "habla", "parle", "spricht")
- For word order: highlight the phrase showing position (e.g., "geht er" to show verb-subject inversion)
- For particles: highlight the particle (e.g., "wa", "ga", "ni" in Japanese)
- For agreement: highlight the ENTIRE agreeing phrase — the noun/subject AND the adjective/modifier (e.g., "la casa blanca" not just "blanca", "le petit chat" not just "petit")
- For tenses: highlight the verb with its tense marker

**CRITICAL for agreement patterns**: Learners must see WHAT is agreeing WITH WHAT. Always highlight both the trigger (noun) and the target (adjective/article) together. Highlighting only the adjective fails to show the agreement relationship.

# Exercises

Provide 1-3 fill-in-the-blank exercises testing the same pattern with new sentences (not copies of examples).

## Exercise Rules

- **Each exercise must have exactly ONE `[BLANK]` and exactly ONE correct answer.** Verify every template contains exactly one `[BLANK]` before finalizing. The `answer` field is a single string — the one correct answer. Do NOT provide multiple alternatives or synonyms; design the sentence so only one answer is correct. If multiple words could fill the blank, restructure the sentence to disambiguate (e.g., add context that makes only one particle/form valid)
- **Verify the answer fits the template.** Mentally substitute it into the `[BLANK]` and read the full sentence. If it produces an ungrammatical or unnatural sentence (e.g., because surrounding words already contain part of the expression), redesign the template
- Include 2-4 distractors (plausible wrong options). Distractors must never include a correct answer
- All sentences, templates, answers, and distractors must be 100% TARGET_LANGUAGE

## CRITICAL: Vary the Correct Answer Across Exercises

**Each exercise must have a different correct answer.** If all blanks produce the same word, the exercises test recognition once and then become trivial repetition.

- For prepositions with gender/case variants (e.g., German "zum" vs "zur"), design sentences that require different forms
- For verb conjugation, use different subjects so the conjugated form changes
- For particles, vary the conditioning environment so the particle choice differs
- If the pattern genuinely has only one invariable form (e.g., a fixed particle), vary what the blank covers — expand it to include surrounding context, or test the pattern in contrasting structures where a different element changes

## CRITICAL: The Blank Must Test the Actual Grammar Concept

**The position and scope of [BLANK] must allow learners to make the mistake the grammar rule prevents.**

Ask yourself: "What error would a learner make without knowing this rule?" The blank must allow for that error.

**Correct blank design by grammar type:**

- **Conjugation**: Blank replaces the verb form. Options test different conjugations.
  - Template: "Yo [BLANK] español." Options: "hablo", "habla", "hablan"

- **Word order** (e.g., German V2): Blank encompasses BOTH the verb AND adjacent element to test relative order.
  - Template: "Morgen [BLANK] nach Hause." Options: "geht er", "er geht"
  - BAD: "Morgen [BLANK] er nach Hause." with options "geht/gehen" — this only tests conjugation, not word order!

- **Particle selection** (e.g., Korean subject markers): Blank replaces the particle after a noun.
  - Template: "학생[BLANK] 공부해요." Options: "이", "가"

- **Agreement**: Blank replaces the element that must agree.
  - Template: "La maison est [BLANK]." Options: "grande", "grand"

**Key principle**: If the grammar concept is about the RELATIONSHIP or ORDER between elements, the blank must include enough elements to test that relationship.

## Distractor Design

Good distractors test common mistakes:

- Wrong conjugation (wrong person or tense)
- Wrong agreement (wrong gender or number)
- Wrong word order placement
- Wrong particle or preposition
- Base form instead of conjugated form

**Every distractor must be a form a real learner would plausibly produce.** Distractors should represent actual mistakes — things learners say or write because of L1 interference, overgeneralization, or incomplete knowledge. Do not invent forms that no speaker would naturally construct (e.g., "zu das" in German — no learner would split a contraction into an ungrammatical phrase they've never encountered).

# Linguistic Accuracy

## Verify Every Decision Mechanically

Do NOT rely on intuition. For every linguistic decision that depends on a word property (consonant/vowel ending, gender, number, etc.), decompose the word and apply the rule step by step. A mistake here directly contradicts the lesson being taught.

**For particle/marker selection**, reason through it for EACH word:

1. Isolate the word the rule applies to
2. Identify the relevant property (final consonant? gender? number?)
3. Determine which variant the rule requires
4. Confirm your answer matches before writing it

**Korean batchim**: The batchim is the bottom consonant component of a syllable block. Look at the LAST syllable of the noun. If it has a bottom consonant component, the syllable ends in a consonant. If only initial consonant + vowel with NO bottom component, it ends in a vowel. Apply this decomposition every time — never assume from memory.

**Japanese**: Correctly identify readings (on'yomi vs kun'yomi) when relevant. The particle は is pronounced "wa" when marking topic, not "ha".

**Chinese**: Ensure tone marks in pinyin are correct. Character stroke counts and radical identification must be accurate.

Learners trust your examples — a linguistic error undermines the lesson even if the grammar rule itself is correctly explained.
