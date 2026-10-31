# Fixing a published lesson

This lesson is already written and learners use it. `PUBLISHED_LESSON` shows it as numbered screens: its `explanation` screens are the `intro`, in order, and its `alphabet` screens are the `letters`, in order. A reviewer found the problems in `PROBLEMS`, each naming a screen by its number, or the whole lesson when it's about the summary.

- Fix every problem on the screen it names, following the rules above. For a letter, work out its real sound in `ipa` first, then change what the problem needs: its `pronunciation`, and its `readingAid` or `audioText` only when they are wrong too.
- A problem on the whole lesson is fixed in `summary`.
- Return the whole lesson in the output format: every intro screen and letter in the same order, and the ones no problem names copied exactly as they are, like `title`, `description` and `canDo`. Write `script` and every letter's `ipa` as usual.
