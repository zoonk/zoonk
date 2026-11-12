# Styleguide

## Voice

Zoonk helps anyone learn anything, especially first-time learners in small towns and under-resourced communities. Write simple, everyday, welcoming text without jargon: friendly and encouraging, never condescending, and never scolding learners for mistakes, breaks, or missed days.

- Use “…” for ellipses. Avoid em dashes.
- Put a no-break space before every “·”, the English one or one you add, so the dot never starts a line or sits alone on one. A language that writes its separator without spaces, such as Japanese “・”, needs none.

## Terms

- Mid-sentence, capitalize a feature name only where the English does or the language's grammar requires it: “Energy”, but “your buddy”.
- A “card” is a speaking exam's task card or a card picked in an activity, never a flashcard.
- Buddies are learning partners, not pets, and their localized names are proper names.
- “Known” and “Known before” mean the learner knew it before studying it in Zoonk.
- Against the Trickster, “broken” counts shield plates broken by right answers; “held” means the shield withstood the attempt. A second go is a “Rematch”.
- “Sure” and “unsure” are the learner's confidence in an answer.
- “q” abbreviates “questions” only in English: write the word.
- English grammar topics keep the English names their learners use, such as “phrasal verbs”, “present perfect” and “past continuous”.

## Plan language

- “Finished”: the learner completed the plan. “Date passed”: its date passed with lessons left, and the plan can still be adjusted.
- “Not in your plan”: the plan has no time for it (older strings say “left out”). “Skipped”: a test showed the learner knew it. “Skip”: the learner's choice. Never translate one with another's word.
- “Up to date”, “behind” and “ahead” are a plan's states against its dates, not software that was updated.
- Write proposed changes as proposals and applied changes as done. A sentence that says what a plan change does is shown for both, so keep it in the present.

## Placeholders

- Buddy names and goal names are the learner's choice, with unknown gender and number: use neutral wording around them. A goal's name is a short label, such as “CGU”, “Italiano” or “Física quântica”, so build the sentence around it the way the English does (“your {goal} plan”).
- The learner's gender is unknown: prefer wording that doesn't mark it.
- Duration placeholders such as `{time}` already include their unit.
- Where the English shows the count, keep it (“#” in web messages; “%lld” or “%d” in Apple and Android ones, where “#” shows as is) inside the sentence of every plural form, “one” included: never a literal “1”, a spelled-out number, a “Label: #” rebuild, or words added to only one form. Word the forms alike, changing only what the count requires. Where the English words a form without the count (“No questions left”, “the first week”, “the closest one”), so does the translation.
