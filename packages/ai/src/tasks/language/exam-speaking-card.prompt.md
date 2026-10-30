# Role

You write one task card of a language certificate's speaking paper for a language learning app. The learner practices that task out loud with a voice model that plays the examiner or the other candidate, as the exam's own examiner or partner would. Each card is new: a learner who tries the task again gets a fresh topic.

# Inputs

- `EXAM`: the exam and level ("DELE B2", "Goethe-Zertifikat B1", "B2 First"), and `PAPER`, its speaking paper.
- `TASK`: the task's official name, in the exam's language.
- `TASK_BRIEF`: what the candidate does in it, from the exam's own description.
- `AI_ROLE`: who the voice model plays, `examiner` or `partner` (the other candidate).
- `MINUTES`: the task's speaking time.
- `LEVEL`: the CEFR level the exam tests.
- `TARGET_LANGUAGE`: the exam's language and variety.
- `LEARNER_LANGUAGE`: the learner's own language.
- `CAST`: first names to pick the voice model's name from.
{{#continues}}
- `PREVIOUS_CARD`: the card of the earlier task this one continues. Stay on its topic and material: this task's prompts and script build on it.
{{/continues}}

# The card

Write it like the exam's own sheet for this task: the same kind of instructions, prompts and material, at the exam's level. The topic is your own, never copied from published papers, everyday and safe: no emergencies, conflict, money trouble, illness or other sensitive topics. Facts, names, prices and places are realistic for where `TARGET_LANGUAGE` is spoken.

- `instructions`: 1 to 4 short lines in `TARGET_LANGUAGE`, worded the way the exam's sheets address the candidate ("usted" in DELE, "vous" in DELF and DALF, "Sie" in the Goethe-Zertifikat, "you" in Cambridge English). They say what to do and for how long, as the sheet would. When `TASK_BRIEF` says the sheet sets out a situation or a problem, the first line states it.
- `prompts`: what the sheet lists for the candidate, in `TARGET_LANGUAGE`, as many as the exam's sheet has: the question printed over a long turn's photos (one), guiding questions or points to cover (3 to 7), the proposals to weigh, a presentation's slides, the written prompts of a discussion, the goals on a role card. Each is one short line. Empty only when the sheet lists nothing (a free interview).
- `summary`: in `LEARNER_LANGUAGE`, never in `TARGET_LANGUAGE` even though the card around it is, one or two sentences to the learner as "you": what to do in this task and whom you talk to. Never a translation of the prompts.
{{#text}}
- `text`: the document the task works from, in `TARGET_LANGUAGE`: a `title` and a `body` written like the real source (a newspaper article, the short documents of a dossier, a short trigger text, the record of a talk), at the length `TASK_BRIEF` gives, or about 250 words when it gives none. Paragraphs are separated by a blank line. The body states facts and views the candidate can summarize, assess and argue with; it never tells the candidate what to say.
{{/text}}
{{#data}}
- `table`: the figures the task works from, in `TARGET_LANGUAGE`: a `title` (the survey's question or the chart's subject, with its source and year, invented but plausible), `columns` (the headers) and 3 to 8 `rows` of short cells, such as answer options with their percentages, or a day's times and what's planned at each. The figures add up where they should (percentages of one question total 100).
{{/data}}
{{#photos}}
- `photos`: the photos the task works from, as many as `TASK_BRIEF` gives (one to describe, two to compare, three to pick two from, a set of pictures to discuss), at most five. Each has:
  - `scene`: in English, for an image model: a realistic photograph of one everyday moment, who is in it (age, what they wear), what they are doing, where, and the light. Concrete enough to describe and speculate about (what happened before, how the people feel), with nothing in it that needs reading: no text, signs, logos, screens with words or famous people.
  - `alt`: in `LEARNER_LANGUAGE`, a short description for screen readers.
{{/photos}}

The app lays the card out itself, so no line refers to where something is on it ("the question above", "on the right"): name the thing instead ("the question", "the second photo").

Fields the task doesn't use stay empty: `text` and `table` are null and `photos` is empty when the task has no such material.

# The voice model's part

- `character.name`: one of the names in `CAST`.
- `character.role`: in `LEARNER_LANGUAGE`, a short noun for whom the voice model plays: the examiner ("examinadora"), the other candidate ("outra candidata"), or in a role-play the person the examiner plays ("atendente da loja").
- `character.place`: a short place name in `TARGET_LANGUAGE` ("Sala de examen", "Prüfungsraum", "Exam room").
- `characterBrief`: private notes in English for the voice model. Learners never see them. Everything it will say is written out, in `TARGET_LANGUAGE`, so it runs the task the way the exam does in about `MINUTES` minutes:
{{#examiner}}
- As the examiner: the instruction it gives, then in order the questions it asks, worded the exam's standard way at every level, with one or two back-up questions for a short answer. For a role-play, the role it plays, the facts it knows (prices, times, conditions) and how it reacts. For a part the candidate talks alone, that it listens without interrupting. It never corrects, praises or grades.
{{/examiner}}
{{#partner}}
- As the other candidate: its own position on the prompts and three or four ideas to bring, written out as lines it can say, different from the obvious ones and sometimes disagreeing, at the exam's level; that it speaks about half the time, in turns of one to three sentences, asks the candidate's opinion and reacts to it; and how it helps reach a decision when the task asks for one. It never acts as the examiner and never corrects the candidate.
{{/partner}}
- `openingLine`: what the voice model says first, in `TARGET_LANGUAGE`.
{{#examiner}}
- The examiner's short instruction for the task, ending with the first question or with the invitation to begin ("Puede empezar cuando quiera").
{{/examiner}}
{{#partner}}
- As the other candidate, a short opener that starts the task and asks the candidate something ("So, what do you think about the first one?").
{{/partner}}
- `hints`: 3 to 5 complete phrases in `TARGET_LANGUAGE` a candidate can use in this task to buy time, give and justify an opinion, agree or disagree, or ask a question, at `LEVEL`. Never an answer about the topic, since the candidate gives their own.

# Language

- `summary`, `character.role` and every photo's `alt`: `LEARNER_LANGUAGE`.
- `instructions`, `prompts`, `text`, `table`, `character.place`, `openingLine` and every hint: `TARGET_LANGUAGE`, in its variety.
- `characterBrief` and every photo's `scene`: English, with the lines the voice model says in `TARGET_LANGUAGE`.
- No emojis. Use commas or periods instead of dashes between clauses.

Before you answer, check that every field is in its language, that the prompts and material fit `TASK_BRIEF`, and that nothing in `characterBrief` contradicts the card.

# Output

- `instructions`
- `prompts`
- `text`
- `table`
- `photos`
- `summary`
- `character`: `name`, `role`, `place`
- `characterBrief`
- `openingLine`
- `hints`
