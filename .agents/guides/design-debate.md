# Design debate

Before building a big new feature or making a structural change, where the choice decides its UX or UI, a new architecture or the data model, two models from different families debate it until they agree, and the agent that owns the task builds the result. Two families find gaps one model misses, and each drops weak ideas once the other shows evidence from the code. They don't know how the user and learners actually work, though, and can agree on assumptions that contradict it. So the brief carries that context, and the owning agent checks their agreement against it before building.

Skip it for smaller changes, even ones with more than one reasonable approach: a small feature, a fix, a change to an existing rule, copy edits, mechanical changes and dependency updates. The agent that owns the task runs the debate and says in its handoff whether it did.

Fable and Astra debate at high ([models](models.md)). When only one family is available, two fresh agents of it debate, and the handoff says so.

1. **Brief:** both get the same brief: the question, the user's constraints and real usage, the current behavior with `file:line` references as the starting point rather than the limit ([think big](../../AGENTS.md#principles)), what the answer must cover, fixed headings for it (for a design with screens, two of them are "Each screen's sketch" and "Edge cases, and which of them the learner never needs to read about"), and a read-only rule (no edits, commits or posts).
2. **First proposals:** each writes its first proposal without seeing the other's, so neither anchors on the other.
3. **Rounds:** relay each one's latest proposal to the other verbatim. Each reply says what it accepts, gives each objection with its evidence, revises its proposal under the same headings, and ends with `AGREEMENT: yes` or `AGREEMENT: no` and what's still open. Rounds cross: each reply answers the other's previous round.
4. **Sign-off:** once they're close, merge their proposals into one list and send it to both to sign. A point still open after a few rounds is the lead's call, listed with both sides, instead of another round.
5. **Decide:** re-check the code claims the agreement rests on, name the assumptions it makes about learners and the user, settle the plan with your own recommendation and build it. The PR lists the plan's calls under **Judgment calls** ([make the call](../../AGENTS.md#scope-and-completion)).

## What a debate about screens decides

A debate decides what each screen is for, what the learner decides there, what they see first and what stays off it. It doesn't write a copy deck: a screen agreed as a list of lines gets built as a list of lines. For each screen the agreed design is its [sketch](../skills/zoonk-design/references/show-first.md#the-sketch): the one thing the eye lands on, what the learner needs there and nothing more, each of those facts' carrier (something already there, a mark, a number, a meter, a label, and a sentence only where nothing drawn can say it), the main action's label, and what it leaves out and where that goes instead.

Before sign-off, the lead or a design agent it briefs draws each sketch at phone size (`pnpm design:sketch`) and runs [the scan](../skills/zoonk-design/references/show-first.md#the-scan) on the pictures, and both sides get them with the merged list, so what is signed is a picture, never a list of sentences. A build brief made from the result carries each screen's picture and sketch as the structure to build, and says: a line the sketch didn't list isn't a requirement, and removing one isn't dropping a feature. The PR shows the built screens.
