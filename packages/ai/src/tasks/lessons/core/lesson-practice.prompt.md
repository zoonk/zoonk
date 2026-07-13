Create a practical interactive lesson from the source lesson metadata.

A practice lesson is a set of concrete situations where the learner uses the lesson concept to make a practical choice.

Write every generated string in `LANGUAGE`: `imagePrompt`, `dialogue`, `question`, option text, and feedback. Technical labels, code, formulas, UI text, file names, and proper nouns may stay in their natural form.

Return only an object with a `situations` array. Do not return a top-level scenario, title, setup text, opening image, or narrator setup.

Each item in `situations` must contain:

- `imagePrompt`: visual evidence for this situation
- `dialogue`: direct speech to the learner, maximum 300 characters
- `question`: one practical application question
- `options`: exactly four short options with feedback

## Goal

Each situation should answer this question:

How would this lesson concept show up in a real observation, problem, report, artifact, measurement, behavior, or decision?

The learner should not be asked to recite a definition. The learner should use evidence in the situation to choose an action, explanation, classification, prediction, verification check, consequence, or repair.

Good practice is usually one inference away from the answer:

- named concept -> choose the action it requires
- defining clue -> classify the object or organism
- observation -> identify the process causing it
- mechanism -> predict what changes next
- claim -> choose how to verify it
- measurement -> compare it with a constraint
- broken record -> choose the precise correction
- exception -> decide whether the case is possible

The concept does not need to be hidden. You may name the concept or state a definition clue when the learner still has to apply it.

Good:

- The greenhouse plant is not making enough sugar through photosynthesis. What change should help first?
- A clinic sample has cells with no nucleus. Which organism best fits that infection?
- The browser keeps the same page path, but the product filter after `?` is wrong. Which URL part should we inspect?

Bad:

- What is photosynthesis?
- Are bacteria prokaryotes or eukaryotes?
- Which URL part is the query string?
- The tray looks strange and the team feels uncertain. Which concept is involved?

## Source Scope

Use only concepts supported by `LESSON`.

Before writing, silently list the concrete ideas from the lesson that deserve practice. For each idea, ask:

- What concept, relationship, mechanism, rule, or condition is in the source?
- What real-world evidence would make this concept useful?
- What should the situation state clearly so the learner is not solving a riddle?
- What should the learner still need to infer, compare, classify, predict, or decide?
- What misunderstanding would create a tempting but wrong answer?

If the lesson explicitly compares a small set of core categories, effects, parts, or cases, practice the main set directly. When the situation count allows it, each core category should be the correct answer at least once. Do not use an explicitly taught core category only as a distractor.

Do not add adjacent topics because they are nearby in the subject. If a candidate situation relies on a concept, mechanism, exception, or rule that is not named or directly implied by `LESSON`, discard it.

## Factual And Evidence Grounding

Every situation must be factually consistent with the source lesson and with the real-world system it uses.

Check exact boundaries, units, syntax, and domain rules before finalizing:

- For formal syntax or notation, parse delimiters and part boundaries exactly. Do not move meaning across boundaries.
- For records, logs, forms, apps, sensors, surveys, photos, or measurements, only treat a detail as evidence when the situation says it was captured or makes it visibly available.
- For quantitative, compatibility, financial, scientific, legal, or technical decisions, calculations, measurements, labels, and constraints must match the question and options.
- For high-precision domains, do not reduce the lesson to a misleading shortcut. Keep the practical decision tied to the actual constraints named in the source lesson.

Every option's truth status must be anchored in the dialogue, image prompt, or source lesson. Do not mark an option wrong because of an unstated fact, and do not make an option plausible only because of evidence that appears nowhere in the situation.

## Situation Design

Each item in `situations` must be self-contained. It should make sense without reading any other item.

Use specific, ordinary contexts:

- plant, animal, patient note, lab result, sample, kitchen object, workshop part, field report, browser link, invoice, budget line, analytics table, sensor reading, customer complaint, damaged object, or visible before/after state

Keep situations focused:

- no recurring case needed to understand multiple items
- no vague puzzle where the concept is hidden
- no unnecessary stakes or side events
- no punchline-first setup
- no classroom demo unless the lesson is actually about teaching or demos
- no situation where the task is making a poster, writing a summary, labeling flashcards, or preparing examples for students
- no task where the learner mainly fixes an annotation, explanation, or lesson label instead of making a practical prediction, check, classification, repair, or decision

Vary the application pattern across the lesson. Do not repeat the same move with different props, such as six items that all ask which object is the medium, six items that all ask which outcome is missing, or six items that all ask which label applies.

## Answer Gap

Dialogue gives evidence. The question asks the learner to use it. The answer appears only in the options and feedback.

The `dialogue` must not include:

- the correct option text
- a close paraphrase of the correct option
- the classification, action, cause, consequence, or conclusion the question asks for
- a sentence that answers the question before it is asked

Bad:

- Dialogue: The aquarium turned green near the window. The algae are producers because they use light.
- Question: How should we classify the algae?
- Correct option: Producers

Better:

- Dialogue: The aquarium turned green near the window. The algae are using light for energy and taking matter from the water and air.
- Question: How should we classify the algae?
- Correct option: Producers

Bad:

- Dialogue: The required check was skipped, so the team should run that check.
- Correct option: Run the required check

Better:

- Dialogue: The record shows the later step, but the earlier required evidence is not visible yet.
- Question: What should the team check first?
- Correct option: Earlier evidence

## Dialogue

`dialogue` is direct speech to the learner. It should sound like a person bringing the learner into the situation, not like a narrator, rubric, or compressed report summary.

Use one natural voice. Do not use speaker labels, stage directions, quotation marks, or screenplay formatting.

Good dialogue usually includes:

- a concrete observation or problem
- the evidence needed to apply the lesson concept
- why the choice matters now

Keep each dialogue under 300 characters. Prefer one or two natural sentences.

Use `{{NAME}}` only in `dialogue`, only when a person naturally addresses the learner. For a typical lesson, use it in one or two dialogues total. If there are at least three situations, at least one dialogue should use `{{NAME}}`. Never use it in every dialogue, never use it as a mechanical prefix, and never use it in image prompts, questions, options, or feedback.

Good:

- {{NAME}}, this plant has stayed in the dark for two days. It is not making enough sugar through photosynthesis, and the new leaves are turning pale.
- The lab note says the cells from the sample have no nucleus, but they are dividing fast inside the wound.
- The URL path is right, but the store keeps showing the wrong size after the filter is applied.

Bad:

- Marina points at the plant and wonders what photosynthesis is.
- {{NAME}}, photosynthesis uses light, so move the plant closer to the lamp.
- Report: duplicated outcomes, missing labels, and overlapping events were found in the table.
- {{NAME}}, what should we do first?

Avoid question marks in `dialogue` unless the line would sound unnatural without one. If dialogue contains a question, it must not duplicate `question`.

## Questions

Ask one practical application question per situation.

Prefer questions like:

- What should we do first?
- What does this report imply?
- Which cause best fits?
- How can we confirm the claim?
- What is happening here?
- What would change next?
- Which example is possible?
- Which check matters first?
- Which correction fixes the record?

The question must be precise enough that exactly one option is defensible.

If multiple wrong options could also be true, narrow the question. Ask for the fix that satisfies all constraints, the first check, the classification that matches the evidence, or the consequence of the specific mechanism.

Reports, logs, tables, traces, and notes are good evidence. The learner's task should usually be to act on that evidence, predict a consequence, choose the right check, or classify the real object. Avoid questions whose main task is to correct wording in a report unless the lesson is about report quality.

## Options

Use exactly four options. Keep them short and scannable, usually 1-5 words.

All four options must answer the same kind of question. If the question asks for a cause, every option should be a plausible cause. If it asks for a fix, every option should be a plausible fix. If it asks for a classification, every option should be a plausible classification.

If the question asks for an action or decision, make the correct option action-oriented enough to answer it. Avoid labels that are so terse the learner has to infer the action. Include a clear decision verb or comparison target when the answer would otherwise be ambiguous.

Good option sets:

- Move toward light / Add more sugar / Seal the leaves / Remove roots
- Bacteria / Animal cells / Plant tissue / Yeast
- Check the nucleus / Count the legs / Change the color / Warm the slide
- Yes, if it has a nucleus / No, unicellular means bacteria / Only if it is green / Only in water

Strong wrong options are not random. They reflect a real misconception:

- wrong requirement
- wrong category
- wrong mechanism
- wrong condition
- wrong source of evidence
- wrong next step
- overgeneralized rule
- incomplete correction
- true concept applied to the wrong situation

Avoid wrong options that are:

- jokes
- absurd or unsafe shortcuts
- unrelated workflow phases
- different answer types mixed together
- obviously impossible from the situation
- true but secondary
- true but incomplete when the question expects a complete fix
- copied from a clue without requiring interpretation

Do not let learners win by elimination. A learner who does not understand the concept should find the wrong answers tempting.

Ground wrong options in the same specific situation. Distractors should be plausible mistakes about the same evidence, rule, object, or mechanism. Do not switch to unrelated objects, unrelated workflow phases, or impossible transformations.

For quantitative, compatibility, or records questions, make the correct option require comparing, combining, or interpreting evidence. Do not simply copy the exact measured phrase from dialogue into the correct answer.

Make labels precise:

- If categories can overlap, label exclusive choices explicitly.
- If a correction requires multiple changes, include the complete correction.
- If a technical claim is about a narrow property, name that exact property instead of a broader mechanism.

## One Correct Answer Audit

Before finalizing each situation, silently test every wrong option.

Reject or rewrite any option if:

- it is actually true in the situation
- it would also solve the problem
- feedback needs to admit it is a real issue
- it is only wrong because the question is vague
- it is a different but reasonable interpretation of the wording
- the image evidence would make it look correct
- it depends on an unstated assumption about what was recorded, measured, captured, visible, allowed, or possible

Wrong-answer feedback must not say "also true", "a real issue", "matters too", or "secondary" unless the option is still clearly insufficient for the exact question.

Bad:

- Question: What is the issue with this record?
- Correct option: One true issue
- Wrong option: Another true issue
- Feedback: That is also true, but the correct option is more important.

Better:

- Question: Which correction satisfies all required conditions?
- Correct option: Complete correction
- Wrong option: Partial correction
- Feedback: This fixes only part of the problem, so one required condition is still unmet.

## Image Prompts

Each `imagePrompt` should show the visual evidence for that exact situation.

Write image prompts in `LANGUAGE`. They must stand alone because the image model sees each prompt in isolation.

Show concrete evidence:

- object, organism, screen, record, sample, table, measurement, label, defect, before/after state, motion, light source, missing part, extra item, threshold, nucleus, field, value, or constraint

Avoid decorative images. Do not add unrelated props, labels, people, or side details just to make the scene busy.

If text in the image matters, keep it short and legible. Use `LANGUAGE` unless the text is naturally code, a file name, formula, technical field name, or imported UI text.

Keep image evidence aligned with the options. Do not show a label, unit, value, or object that creates an unlisted correct option or contradicts the intended answer.

{{FEEDBACK}}

## Final Check

Before returning the JSON, run this audit for every situation:

- Does it apply a concept from `LESSON` in a concrete real-life situation?
- Is it independent from the other situations?
- Does the full set directly practice every explicitly compared core category when the situation count allows it?
- Is the concept clue clear instead of hidden behind vague hints?
- Does the learner still need to apply the concept?
- Does dialogue avoid saying the correct option or direct answer?
- Does dialogue sound like a person, not a report summary?
- Are all facts, syntax boundaries, numbers, units, and domain constraints correct?
- Are all four options plausible and on the same decision axis?
- Is exactly one option defensibly correct?
- Are wrong options false, incomplete, unsafe, irrelevant, or clearly inferior for this exact question?
- Is each option's truth status supported by stated or visible evidence?
- Does feedback avoid admitting a wrong option is also true?
- Are labels, numbers, units, and category boundaries precise?
- Does the image prompt support the same answer as the text and options?
- Are situations varied instead of repeating one pattern?
- Is `{{NAME}}` used in at least one dialogue when there are three or more situations, but not in every dialogue?
