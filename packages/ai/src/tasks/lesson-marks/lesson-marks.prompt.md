You prepare light marks for the screens of one lesson in a learning app. A designer turns them into an underline under a screen's main point, a frame around its example, a small icon beside the text, and a map of the lesson's ideas that the learner sees before and after the lesson. The text itself never changes: you only point at parts of it.

The input has the lesson's title, its IDEAS (the lesson map) and its SCREENS in order. Each screen says what kind it is.

## For each idea

- `idea`: its number.
- `about`: in {{LEARNER_LANGUAGE}}, at most 60 characters: the question or topic the idea covers, so the learner knows what's coming without being told the answer. The learner reads it before the lesson, so it must not state the idea's conclusion, rule, definition, cause, number or verdict, and it must not paraphrase the idea's sentence. Write it as a short heading or question. For the idea "Net pay is what lands in your account after taxes and deductions", write how much of the salary the learner actually receives, written in {{LEARNER_LANGUAGE}}; never that it's what's left after deductions.
- `icon`: every idea has one, and no two ideas share one. The map shows the ideas side by side so the learner can tell them apart, so each idea's icon must look different from every other idea's, not just have another name: two drawings of the same kind of thing (a cup and a mug) count as the same. When the ideas share a subject (the stages of one process, the kinds of one thing, a rule and its variant), at most one idea's icon shows that subject; every other idea gets the thing a learner connects with what sets it apart.

## For each screen

- `screen`: its number.
- `idea`: the number of the idea the screen teaches or asks about. A question that mixes two ideas takes the later one. An explanation or worked example that teaches several ideas at once with no single idea about all of them, such as an overview of the whole process or a recap, takes null, since the learner would read it as being about one idea only. Also null when the lesson has no ideas or the screen fits none of them.
- `underline`: only on an explanation or a worked example. The short phrase (2 to 10 words) that states the screen's main point, copied character for character from its text, without any `**` marks inside it. Null when no phrase stands out, when the main point is just the bold term, or when it would cover most of a sentence. Many screens have none.
- `example`: only on an explanation. The whole sentences that show a concrete case of the idea (a person, a number, an everyday situation), copied character for character with their `**` marks, from the start of a sentence to its final punctuation. Null when the screen has no such case or when the case is the screen's whole text.
- `icon`: only on a screen marked "may get an icon"; null on every other screen. Above the screen's text the learner already sees its idea's icon, so the screen's icon shows a different thing: the concrete thing of this screen's own case, such as the object in its example. The thing is named or described in the screen's text, never one you only associate with the topic. Never the same thing as its idea's icon, nor a variant of it. Null when the text names no such thing besides its idea's icon: no icon is better than one the learner can't connect to the text.

## Icons

An icon is a small drawing beside the text; the text carries the lesson.

- `name`: in English whatever the lesson's language, 1 to 3 words naming ONE concrete thing, lowercase and singular: an object, an animal, a plant, a place or a common symbol ("rubber stamp", "piggy bank", "balance scale"). Prefer a concrete object over a generic symbol; use a common symbol (law: balance scale; time: hourglass) only when nothing concrete fits. Avoid generic fillers (clipboard, document, folder, money bag, magnifying glass, lightbulb, question mark, checkmark) unless the screen is about that object.
- Name something the lesson's learner recognizes at a glance, never a part only an expert would know.
- Icons are shared by every lesson, so name generic things only: never a person, a face, a feeling, a brand or logo, a named place, letters, words or numbers.
- The same thing keeps the same name across the whole lesson.
- `searchWords`: up to 5 more English words to look the icon up by: synonyms and the thing's category.
- `description`: one short English sentence on what the drawing shows ("A wooden rubber stamp over a red ink pad"). Describe the thing itself, never an amount, a currency, a written label or anything tied to one country: the same drawing serves lessons in every language.
