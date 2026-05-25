# Goal

Create an explanation-first grammar lesson for a language course.

The learner should understand what to look for before seeing examples. Start with a clear explanation, then show target-language examples, then ask fill-in-the-blank questions at the end.

# Output Shape

## `explanations`

Provide 1-3 short teaching sections in USER_LANGUAGE.

- `title`: short label for the rule or sub-rule
- `text`: plain-language explanation of how the grammar works and what learners should watch for

## `examples`

Provide 2-4 examples after the explanation.

- `sentence`: TARGET_LANGUAGE sentence
- `highlight`: the grammar element being taught
- `translation`: natural USER_LANGUAGE translation of the full sentence

## `questions`

Provide 1-3 fill-in-the-blank questions at the end.

- `question`: optional USER_LANGUAGE prompt. Use `null` when the template is self-explanatory.
- `template`: TARGET_LANGUAGE sentence with exactly one `[BLANK]`
- `answer`: the one correct TARGET_LANGUAGE answer
- `distractors`: plausible wrong TARGET_LANGUAGE answers
- `feedback`: concise USER_LANGUAGE explanation of why the answer fits

# Language Rules

- `explanations.title`, `explanations.text`, `examples.translation`, `questions.question`, and `questions.feedback` must be in USER_LANGUAGE.
- `examples.sentence`, `examples.highlight`, `questions.template`, `questions.answer`, and `questions.distractors` must be in TARGET_LANGUAGE.
- Do not generate romanization. Romanization is handled by a separate step.
- When quoting TARGET_LANGUAGE words inside USER_LANGUAGE explanations or feedback, keep the original script.

# Teaching Rules

- Focus on one grammar point only.
- Explain the rule before examples. Do not ask the learner to discover the pattern first.
- Explanation titles must name the actual grammar point being taught, not a nearby observation. For example, if the lesson is about adjective gender agreement, do not title it as adjective position unless position is the rule being taught.
- Do not introduce secondary rules in explanations unless they are necessary for the target rule and are demonstrated consistently by the examples.
- Do not create target-language sentences that are only technically interpretable but unnatural. Practice items should sound like something a native speaker would actually say.
- If the lesson is about agreement, keep word order and adjective placement natural for each specific word. Do not move adjectives into an unnatural position just to make the agreement contrast easier to see.
- Keep explanations short and concrete. Avoid academic grammar jargon unless it directly helps the learner.
- Use level-appropriate vocabulary so the learner can focus on the grammar, not decoding new words.
- Use examples and questions that all test the same grammar point.

# Example Rules

- The grammar element must be visible in every sentence.
- Keep beginner/intermediate sentences short, usually 5-10 words.
- Sentences should sound natural, not like textbook fragments.
- Build progressively: start with the clearest case, then show variations.
- For verb conjugation, prefer showing different persons/forms across examples. Avoid regional forms unless the lesson specifically targets them.
- Use consistent script choices within a lesson. If examples use kanji for a word, questions should too.

# Highlighting Rules

The `highlight` field isolates the grammatical element being taught. Use a phrase when the grammar concept involves relationships between elements:

- For verb conjugations: highlight the verb form, e.g. "habla", "parle", "spricht".
- For word order: highlight the phrase showing position, e.g. "geht er" to show verb-subject inversion.
- For particles: highlight the particle, e.g. "は", "が", "に".
- For agreement: highlight the entire agreeing phrase so learners see what agrees with what, e.g. "la casa blanca", not just "blanca".
- For tenses: highlight the verb with its tense marker.

# Question Rules

- Each template must have exactly one `[BLANK]`.
- Each question must have exactly one correct answer.
- The answer must fit naturally when substituted into the template.
- Include 2-4 distractors. Distractors must not include the correct answer.
- Distractors should represent real learner mistakes: wrong conjugation, wrong agreement, wrong word order, wrong particle, wrong preposition, or base form instead of conjugated form.
- For agreement questions, prefer real forms with the wrong gender, number, case, or person over made-up forms.
- Vary the correct answer across questions when the rule allows it. If the rule has one invariable form, vary what the blank covers or use different contexts that still test the same concept.

# Blank Design

The blank must test the actual grammar concept. Ask: "What error would a learner make without this rule?" The blank must allow that error.

- Conjugation: blank replaces the verb form.
- Word order: blank includes enough words to test relative order.
- Particle selection: blank replaces the particle after a noun.
- Agreement: blank replaces the element that must agree.

For agreement blanks, choose nouns and modifiers that produce natural target-language sentences in both examples and completed questions. Avoid adjectives whose normal position would introduce a separate word-order issue.

# Linguistic Accuracy

Verify every linguistic decision mechanically. For any rule that depends on word properties such as final consonant, gender, number, case, or person:

1. Identify the word the rule applies to.
2. Identify the relevant property.
3. Determine which form the rule requires.
4. Confirm the answer and distractors match the intended contrast.

For Korean batchim, inspect the final syllable of the noun before choosing particles. For Japanese, distinguish particle spelling from pronunciation when relevant. For Chinese, tone marks and character choices must be correct.
