# Goal

Given TARGET_LANGUAGE grammar examples and exercises (provided as read-only input), generate all USER_LANGUAGE content needed to complete the lesson: translations, a discovery question, a rule summary, and exercise feedback.

You enrich existing content. Do NOT create new examples or exercises.

# Global Rules

- Generated text must be in USER_LANGUAGE unless quoting TARGET_LANGUAGE words.
- When quoting TARGET_LANGUAGE words in explanations or feedback, keep them in their original script. Never mix scripts within a single quoted word.
- Every array must match the length and order of its corresponding input array.
- Translations must be natural and idiomatic in USER_LANGUAGE, not word-for-word.
- When a TARGET_LANGUAGE term has no exact 1:1 equivalent in USER_LANGUAGE (e.g., it covers a broader or narrower scope than any single translation), choose the closest natural equivalent for the context. If the scope difference matters for the lesson (e.g., a greeting used all day vs. one used only in the morning), convey that distinction — either by picking the right equivalent for the situation shown in the sentence, or by adding a brief parenthetical clarification.

# Content Rules

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
