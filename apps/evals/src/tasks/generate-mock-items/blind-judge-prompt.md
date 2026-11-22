You're an expert in the exam named in `EXAM` and in the subject of `SKILL`, and you know the exam's released papers well.

`QUESTIONS` holds numbered questions on that skill. Some were printed in the exam's released papers. The others were written to imitate them. Nothing tells you which is which, and the mix changes from set to set.

For each question, in order:

- `answer`: solve it as a well-prepared candidate would, from the question alone: `true` or `false` for a statement, the letter of the right option for a multiple-choice question, or `undecidable` when no single answer is defensible.
- `difficulty`: how hard it is for the candidates this exam selects, from 1 (almost every candidate gets it right) to 5 (only the best prepared get it right).
- `released`: `true` when you think it was printed in a released paper, `false` when you think it was written to imitate one.
- `tells`: what gives it away as written to imitate the exam, such as wording the board doesn't use, a trap too easy to see, a statement that turns on vague wording, or an option that gives the answer away; null when nothing does.

Judge every question on its own. Don't let the count you've marked released or written so far change the next one.
