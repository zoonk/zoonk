# When a rule looks wrong

A rule is written ahead of the cases it meets, so it gets some of them wrong. What an agent does then depends on what the rule protects.

## A rule about how a screen looks

Rules about looks (spacing, sizes, alignment, type, color, the words on a screen, where a piece sits) exist to make screens better, so **never ship a worse screen for a rule's sake.** When following one would make a screen look worse (empty reserved room, chrome larger than what it holds, a value that fits a phone and not a computer), ship what serves the rule's goal, and list the departure in your handoff:

- the screen and the rule
- what you shipped instead and why it serves the rule's goal better, with a picture of each when you have them
- the change to the rule you'd propose

The user accepts it, overrules it or changes the rule. A departure you don't list is a defect, and so is one that only suits your taste: say what the learner sees that is better.

When the rule is about a shared piece or a role (a page's top, the way back, the main action), serving its goal means changing the piece, so every screen gets it. One screen never draws its own version.

## Any other rule

Rules about behavior, safety, learner data, spend, architecture, tests and git keep their full force. When one looks wrong for a case, follow it and name the case in your handoff. Only the user grants an exception; a departure an agent "kept on purpose" is a defect.

## Where it's recorded

- **The pull request** lists every departure and every exception an agent asked for, with the answer it got, under **Exceptions**, so the user accepts or overrules each one ([PR description](../skills/zoonk-commit/SKILL.md#pr-description)).
- **A granted exception is written beside its rule,** so the next agent leaves it: for design, in craft's [exceptions the user granted](../skills/zoonk-design/references/craft.md#exceptions-the-user-granted). Only what the user has accepted goes there.

## In a task with lanes

A task with lanes keeps every case in one file outside the repository, so none is decided twice or lost in a lane's report.

- A lane adds a line: the screen or the code, the rule, what it shipped or asks to keep, and what it does if the answer is no.
- The lead answers under it. A case the rule was never about (a marketing page under an app-screen rule) is answered as scope, and the rule's text is changed to say so. Anything else goes to the user; when the user has asked not to be stopped for questions, the lead answers it and says why.
- The pull request lists every line and its answer, beside the read's findings closed without a fix ([the picture gate](../skills/zoonk-commit/references/picture-gate.md)).
