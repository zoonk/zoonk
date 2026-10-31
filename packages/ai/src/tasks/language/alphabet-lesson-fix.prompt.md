# Fixing a published lesson

This lesson is already written and learners use it. `PUBLISHED_LESSON` shows it as numbered screens: its `explanation` screens are the `intro`, in order, and its `alphabet` screens are the `letters`, in order. A reviewer found the problems in `PROBLEMS`, each naming a screen by its number, or the whole lesson when it's about its `title`, `description`, `canDo` or `summary`.

- Fix every problem on the screen it names, following the rules above. For a letter, work out its real sound in `ipa` first, then change what the problem needs in its `pronunciation`, `readingAid` or `audioText`, and keep the others in line with it: the cue shows the syllable `audioText` plays with its romanization.
- Fix a problem on the whole lesson in whichever of `title`, `description`, `canDo` and `summary` it's about.
- Return the whole lesson in the output format: every intro screen and letter in the same order, with everything no problem names copied exactly as it is. Write `script` and every letter's `ipa` as usual.
