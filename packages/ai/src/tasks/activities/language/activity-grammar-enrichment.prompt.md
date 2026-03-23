# Goal

Given TARGET_LANGUAGE grammar examples and exercises (provided as read-only input), generate all USER_LANGUAGE content needed to complete the activity: translations, a discovery question, a rule summary, and exercise feedback.

You enrich existing content. Do NOT create new examples or exercises.

# Global Rules

- ALL output text must be in USER_LANGUAGE unless quoting TARGET_LANGUAGE words.
- When quoting TARGET_LANGUAGE words in explanations or feedback, keep them in their original script. Never mix scripts within a single quoted word.
- Every output array must match the length and order of its corresponding input array.
- Translations must be natural and idiomatic in USER_LANGUAGE, not word-for-word.
- For `pt` output, use Brazilian Portuguese. For `es` output, use Latin American Spanish. For `en` output, use US English.

# Output Fields

## `exampleTranslations`

One natural translation per input example sentence. Preserve meaning and tone.

## `exerciseTranslations`

One natural translation per input exercise. Translate the full sentence as if `[BLANK]` were filled with the correct answer.

## `discovery`

A multiple-choice question asking learners to identify the grammar pattern visible in the examples.

**Question**: Frame as "What pattern do you notice?" or "What do these examples have in common?" Do not reveal the rule.

**Options** (exactly 4, exactly 1 correct):

| Option       | Strategy                                                              |
| ------------ | --------------------------------------------------------------------- |
| Correct      | Accurately describes the core grammar pattern visible in the examples |
| Distractor 1 | A true but superficial observation (not the main pattern)             |
| Distractor 2 | A common misconception about this grammar point                       |
| Distractor 3 | Plausible-sounding but incorrect                                      |

**Feedback per option**:

- Correct: Confirm the observation and briefly explain why it matters
- Incorrect: Acknowledge what they noticed, then redirect to the key pattern

**Null case**: If the examples don't clearly demonstrate a discoverable pattern (e.g., only one example), set `question` to `null`, `context` to `null`, and return an empty `options` array.

## `ruleName`

Short name for the grammar rule in USER_LANGUAGE.

## `ruleSummary`

Maximum 2 sentences in USER_LANGUAGE. Confirm what the examples demonstrate using clear, simple language. Do not introduce concepts beyond what the examples show.

## `exerciseQuestions`

One entry per exercise. Optional scenario framing displayed above the exercise. Set to `null` if the exercise is self-explanatory.

## `exerciseFeedback`

One entry per exercise. Explain why the correct answer fits the grammar pattern. Keep it concise and focused on the rule. Quoting TARGET_LANGUAGE words is expected.

# Explanation Specificity

When explaining why a particular form is used, name the specific condition that determines it. Generic explanations teach nothing.

- Good: "이 is used after 학생 because the final syllable (생) ends in a consonant (ㅇ batchim)."
- Bad: "이 is used because it depends on the previous word."
- Good: "The ending -o matches the first person singular subject yo."
- Bad: "The ending changes based on the subject."

For allomorphic forms, name the conditioning environment explicitly (e.g., "after a consonant-final syllable" vs "after a vowel-final syllable").

# Output Format

Return an object with this structure:

```json
{
  "ruleName": "Present Tense -ar Verb Conjugation",
  "ruleSummary": "Spanish -ar verbs change their ending to match the subject: -o (yo), -a (ella), -amos (nosotros). This is called conjugation.",
  "exampleTranslations": ["I speak Spanish.", "She speaks with her mother.", "We speak a lot."],
  "discovery": {
    "question": "What pattern do you notice in the highlighted words?",
    "context": null,
    "options": [
      {
        "text": "The verb ending changes based on who is doing the action",
        "isCorrect": true,
        "feedback": "Correct! The verb 'hablar' changes its ending (-o, -a, -amos) to match the subject."
      },
      {
        "text": "All the sentences are about speaking",
        "isCorrect": false,
        "feedback": "That's true, but look more closely at the highlighted words. Notice how 'habl-' stays the same but the ending changes?"
      },
      {
        "text": "Spanish verbs always end in -ar",
        "isCorrect": false,
        "feedback": "Not all Spanish verbs end in -ar. Focus on what changes in the highlighted words across the examples."
      },
      {
        "text": "The verb comes before the subject",
        "isCorrect": false,
        "feedback": "Word order varies in these examples. Look at the verb endings — what changes between hablo, habla, and hablamos?"
      }
    ]
  },
  "exerciseTranslations": ["You speak very well.", "They work in the office."],
  "exerciseQuestions": [null, "Say that they work in the office:"],
  "exerciseFeedback": [
    "With 'tú' (you), -ar verbs use the ending '-as', giving us 'hablas'.",
    "With 'ellos' (they), -ar verbs use the ending '-an', giving us 'trabajan'."
  ]
}
```
