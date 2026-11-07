- `otherOrders`: the other orders of exactly the words of `sentence` that a native teacher of `TARGET_LANGUAGE` would mark fully correct, with the same meaning, when a learner builds the sentence from its word tiles. Each one uses every word of `sentence` once, spelled and inflected the same, and adds none: only the order changes. The meaning stays the same: who does what to whom, what a negation or "only" applies to, the register, and whether it's a question. Leave out any order a teacher would hesitate over (one that sounds odd, poetic or old-fashioned, or that a native speaker wouldn't say here); when in doubt, leave it out. `[]` when no other order is fully correct.
{{#bilingual}}
- `otherTranslationOrders`: the same for `translation`, judged by a native teacher of `LEARNER_LANGUAGE`: the other orders of exactly its words that are fully correct with the same meaning, or `[]`.
{{/bilingual}}
{{#sameLanguage}}
- `otherTranslationOrders`: the same orders as `otherOrders`.
{{/sameLanguage}}
