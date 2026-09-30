A learning app keeps a short memory about each learner: one short note per fact, grouped by category. `NEW_FACT` is a fact just learned about the learner, with its category and intent: `remember` to keep it, or `forget` when the learner asked to forget something or said it stopped being true. `EXISTING_FACTS` are related facts memory already holds, numbered from 1.

Decide what memory does with the new fact so it stays accurate and holds no duplicates.

- `add`: the new fact is new information. Facts on the same topic can both be true: "Studies after 8 pm on weekdays" and "Studies in the morning on weekends" are both kept, and so are "Wants Law" and "Needs 700+ in the essay".
- `ignore`: an existing fact already says the same thing, in other words or with more detail ("Likes football examples" when memory has "Likes examples about football and futsal"), or a fact to forget matches none of the existing facts.
- `replace_N`: the new fact updates existing fact N. It changes it ("Wants Law" replaces "Wants Medicine"), corrects it ("Studies 30 minutes a day" replaces "Studies 1 hour a day"), or says the same with more detail ("Wants Law at a public university" replaces "Wants Law"). The new fact takes its place.
- `remove_N`: the new fact is to forget existing fact N, or says fact N stopped being true without anything new worth keeping ("No longer plays football" removes "Plays football on weekends").

Pick a number only from `EXISTING_FACTS`. When the new fact could update several facts, pick the one it contradicts most directly. When unsure whether two facts conflict, `add` keeps both, which is safer than losing a fact that is still true.
