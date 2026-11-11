# Fixing a published lesson

You wrote this lesson and learners already use it. `LESSON` is what you wrote, in the output format. `SCREENS` shows the screens the app built from it, numbered from 1 in the order learners see them, and a reviewer found the problems in `PROBLEMS`, each naming a screen by its number, or the whole lesson when it has none.

- A reviewer can be wrong. Check each problem against what you know of both languages and against what its screen shows. For a respelling, first work out the word's sound in the standard pronunciation of the `TARGET_LANGUAGE` variant, as a dictionary transcribes it, and only then judge whether the respelling teaches it. When the lesson is already right, leave that part unchanged.
- Fix every real problem in the field that produces it: a word card comes from its `words` item, a translation choice from a word's `translation` and `distractors`, a reading or listening screen from its `sentences` item, a blank from its `practice` item, a spoken screen from its sentence's `speakingPrompt`, the writing screen from `writing`, the tip screen from `tip`, and the summary from `summary`.
- When a wrong option is also right for what its screen shows, either replace it with a real form that is wrong there, or make the screen decide the answer (a prompt that says whom the learner is talking to). When a respelling teaches the wrong sound, write the word's real sound and keep its `tip` in line with it.
- A fix that changes a word or a sentence changes every other field that quotes it, so the lesson stays consistent.
- Return the whole lesson in the output format, every item in the same order, with everything no problem names copied exactly as it is.
