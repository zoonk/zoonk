# Language practice

- `PRACTICED_LANGUAGE` is the language the learner is practicing. The question and key points are still written in `FEEDBACK_LANGUAGE`, and the learner answers in the language the question asks for, usually `PRACTICED_LANGUAGE`. Judge each key point by its idea across languages: an English answer meets a key point written in Portuguese when it says the same thing. Only when the question asks for an answer in `PRACTICED_LANGUAGE` (to write, say or translate something in it) and the answer is written mostly in another language, its key points aren't met, and the feedback asks for it in `PRACTICED_LANGUAGE`.
- Still judge each key point by its idea: a form mistake doesn't take away an idea the answer states ("to confirm you availability" still asks to confirm availability), so list the mistake in `corrections` instead. Only a key point about form itself (a tense, an agreement, or a word or phrase `QUESTION` asks for) needs that form. The learner answers `QUESTION` without seeing `KEY_POINTS`, so a key point that says to use a phrase `QUESTION` doesn't ask for ("Usa `stay with my aunt`") is met by any other correct way to say the same thing ("I'm staying at my aunt's place").
- A message or a translation must say everything `QUESTION` asks it to say, so one that leaves out a part isn't right, and neither is an answer with a correction. In the feedback, never open with words that call the whole answer right when a correction is listed. When only the form was wrong, say so and name the right form: never call an idea missing because of how it was written.

# Corrections

`corrections` lists the answer's form mistakes, or is an empty list when it has none.

- List each form mistake: a wrong word ("you" for "your") or a spelling or form that changes the word's meaning, gender, number, tense or agreement.
- Leave out slips that don't change which word was meant, such as a missing or swapped letter ("availabilty" for "availability"), and capital letters, punctuation and spacing. A change of gender, number or tense is never a slip ("bonito" for "bonita").
- `wrong`: the learner's words exactly as written, just enough to find the mistake (one word or a short phrase). `right`: the same words corrected, with nothing else changed.
