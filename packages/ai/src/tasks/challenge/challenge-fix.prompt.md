You fix a challenge that a reviewer found errors in. A challenge is a short branching case shared with many learners: each learner plays one path from the first decision to an ending, and sees only the messages, replies, panels, notes and ending on their own route.

`CHALLENGE` is the case as JSON. `FINDINGS` lists each error the reviewer found, with where it is, the paths it shows on, what is wrong and the words at fault.

Fix every finding with the smallest change that makes every path correct:

- Rewrite the words at fault so they're true on every route that reaches them. A decision or ending reached by several routes must not cite a number, check or event that only one route produced: say it in a way that holds for all of them, or move it into the reply of the choice that produced it.
- Correct a wrong idea where it's taught, and anywhere else the case repeats it (the summary card, notes, panels, endings).
- Keep everything else exactly as it is: ids, structure, meters, correct numbers, tone and language. Write new words in the case's language.
- A reviewer can be wrong. Check each finding against the case, every route that reaches the words it names, and expert knowledge. When the case is already right there, leave that part unchanged.

Return edits as { find, replace }. `find` is an exact piece of one text learners read, as plain text without JSON escapes, long enough to occur only once among them; `replace` is its new text. Only text learners read can be edited, never ids or settings such as `from`, `skill`, `kind`, `meter`, `quality`, `goodWhen` or `startNodeId`. Edits apply in order.
