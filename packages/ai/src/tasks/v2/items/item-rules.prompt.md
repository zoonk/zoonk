# What makes a good question

- It makes the learner use the skill in a situation: apply, predict, compare, diagnose, calculate or explain. Never ask to recall a definition word for word.
- Each question stands alone. A learner who never saw a lesson, but has the skill, can answer it.
- It never gives its answer away: the learner does the skill's work. The context and the question hold only what the learner needs to start, and no option shows that work (see the formats).
- Situations are concrete and realistic. When `FIELD` is given, set every question in that field's everyday work: the tasks, documents, numbers and people someone there deals with (a nurse's shift and patients, a store's sales and stock). The question still tests `SKILL` and nothing else the field knows: someone with the skill can answer it without knowing more about that job. Keep it general to the field, with no specific employer.
- Vary the situations and what each question asks, and spread the difficulty (`easy`, `medium`, `hard`) across the set.
- Fit `LEVEL`: overview and beginner questions use everyday words and one step; intermediate combine two ideas; advanced ones need judgment or several steps.
- Be correct. If a fact depends on a country, a date or an edition, name it in the question. Never invent statistics, laws or quotes.
- All learner-facing text is in `LANGUAGE`. Speak to the learner as "you" in reasons and feedback.
- Situations use the money, names and places in `LOCAL_CONTEXT`, unless `EXAM` or the skill sets another place (SAT questions stay American even in Portuguese).

# Exam style

When `EXAM` is given, write original questions that look, read and score like that exam's real ones, following `EXAM_STYLE`: its structure (support text, command, number of options), tone, length and typical traps. `LEVEL` and the difficulty set how demanding a question is within the exam: even an `easy` question reads like one of the exam's easier real questions, never like a school exercise below it. Never copy or lightly edit a real past question. When `EXAM` is "none", write clear everyday questions.

# Text and tables

- Write plain sentences. When a question needs data a learner reads in rows and columns, put it in `context` as a GFM pipe table: a header row, a delimiter row (`---:` under columns of numbers), one row per line, and a blank line before and after it. Never put a table in `question` or an option.
- Use no other Markdown, except **bold** or _italics_ on a word that needs it.

# Formats

## multipleChoice

- `context`: the situation or support text the question needs, or null when the question stands alone.
- `question`: the command, short and unambiguous.
- `options`: exactly `OPTION_COUNT` options with exactly one correct. Options are similar in length, specificity and confidence, and none of them is "all of the above" or "none of the above".
- An option's `text` starts with the answer itself, never a letter or number ("A)", "(B)", "c."), even when `EXAM_STYLE` names its letters: the app shuffles the options and shows its own.
- Options are answers only. When the learner must work something out to choose (a price per unit, a rate, a total), the options name only the choices ("The pack of 6"), never the values that decide it ("The pack of 6, at $2.00 each"): comparing printed results skips the skill. When the question asks for the value itself, the options are the candidate values. Reasons and hints go in `reason`, never in an option's text.
- Every wrong option comes from a specific, realistic mistake a learner makes with this skill. Its `misconception` is a short neutral label of that mistake (for example "Divides by the number of items instead of the total"), and its `reason` tells the learner why the option is wrong, naming the mistake ("You divided by 4, the number of friends, instead of…").
- The correct option has `misconception` null and a `reason` that says why it is right.

## trueFalse

- `statement`: one assertion the learner judges right or wrong, with `context` when it needs a support text.
- About half of the statements in a set are true. False statements hide one realistic trap: a swapped concept, a wrong exception, an absolute word ("always", "never") that breaks the rule, or a wrong number.
- `reason` explains the judgment. `misconception` labels the trap of a false statement, and is null for a true one.

## typed and spoken

- `question`: asks for a short answer or an explanation in the learner's own words. Spoken questions can be answered aloud in 15 to 60 seconds.
- `keyPoints`: 1 to 5 ideas a full answer must state, each one idea that a grader can check on its own.
- `acceptedAnswers`: for short answers of up to five words, every correct wording worth accepting (synonyms, common forms). Empty for explanations.
- `sampleAnswer`: a model answer that meets every key point.

## essay

- `question`: the writing task, with `context` for its support texts.
- `rubric`: the criteria it is graded on. For an exam with an official rubric (such as ENEM's five competencies), use that rubric's criteria.
- `points`: a row's whole points when the exam's scoring guidelines give each row its own, as AP free-response questions do. For an AP question, write the rubric the way its course's scoring guidelines read: one row per point-bearing requirement, each `description` saying exactly what earns its points (for a long essay: thesis 1, contextualization 1, evidence 2, analysis and reasoning 2; for a science question: one row per part, such as "(a) Identifies the independent variable", 1). Use null for exams whose rubric gives no points per row.
- `keyPoints`: what a strong answer must include. `sampleOutline`: a short outline of a strong answer.

## matchPairs

- `pairs`: 2 to 6 pairs where each left item matches exactly one right item. Keep them to short labels. `reason` explains the matches.

## order

- `steps`: 2 to 7 steps in the only correct order, where swapping any two neighbors makes it wrong. `reason` explains the order.

## numeric (math as data)

- `context` and `question`: the problem, writing each variable as `{name}` where its value goes (for example "A shirt costs {price} and is {discount}% off. How much do you pay?"). Every variable appears in one of them, since the learner needs every value.
- `math.variables`: every variable with its `value` in this question, and a realistic `min`, `max` and `step` for new versions. Every combination in those ranges must still make sense.
- Variable names are plain identifiers (letters, digits and underscores, starting with a letter), such as `price` or `rate_percent`.
- `math.solution`: the expression that computes the answer from the variable names, using numbers, `+ - * / ^`, parentheses, the functions `sqrt`, `cbrt`, `abs`, `min`, `max`, `round(x, digits)`, `floor`, `ceil`, `ln` (natural logarithm), `log10`, `exp`, `sin`, `cos`, `tan` (radians), `rad` and `deg`, and the constants `pi` and `e`. Write percentages as divisions (`price * (1 - discount / 100)`).
- `math.answer`: the correct answer for the values given. `math.unit`: its unit or null.
- `math.tolerance`: how far an answer may be from the exact value and still count. Use `{ "kind": "absolute", "value": 0 }` for exact answers, an absolute value of half the last digit shown for rounded answers (0.005 for cents, 0.05 for one decimal), or `{ "kind": "relative", "value": 0.01 }` for measurements where being 1% off is fine.
- `math.steps`: the worked solution, one short step each. Write `{name}` for a variable's value and give the step an `expression` when it computes something, writing `{result}` where that computed value goes ("{discount}% of {price} is {result}"). Never type a computed number into a step or the question: new versions change every value, so only placeholders stay right.
- `math.commonMistakes`: 1 to 3 realistic wrong methods, each as an `expression` over the same variables with its `misconception` label and a `reason` that tells the learner what went wrong.

# Final check

Before answering, make sure every question has exactly one defensible correct answer, the answers are right, no option shows the computed result or the reasoning that picks it, no two questions test the same thing in the same way, and all learner-facing text is in `LANGUAGE`.
