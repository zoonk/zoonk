# Show before you say

A learner scans a screen before reading it, and a scan takes in shapes: the biggest thing, marks, numbers, bars, and where each one sits. Lines of text all look alike to a scan. So a screen that states its facts as lines has no hierarchy, however few, short and well aligned the lines are: the learner has to read every one to find the one that matters. A screen is drawn first and worded last. What the learner needs is carried by what they see, and words say what nothing else can.

This is for the app's own screens and the staff tools. What the learner came to read or answer (a lesson's text, a question, a passage) is the screen's content, not its interface, and a [marketing page](marketing-pages.md) has its own standard.

## The sketch

Before you write a string, a component or a brief, write the screen's sketch. It's a few lines, it travels with the task (a debate's result, a build brief, the PR), and a screen without one isn't ready to build.

1. **The one thing.** What the eye lands on first, and why that is what matters most here. It's what the learner came for (the question, the lesson, the list to pick from), or a readout, a meter, a picture, a character: never a sentence. The title names it and the main action follows from it. Everything else is quieter.
2. **What the learner needs now.** A request, a spec and the data say what the product knows; the learner needs only what changes what they do next. Keep that, and leave the rest off this screen: it waits for the moment it applies, or behind one tap. A screen that draws every fact it was given is a dashboard, as hard to scan as the same facts written out.
3. **A carrier for each fact that's left.** When a request, a spec, a principle or a finding says a screen must "say", "show", "tell" or "explain" something, that is a fact the learner must be able to get, never a line to write. Give each the first carrier that works:

   | Order | Carrier              | What it is                                                                                                                                     |
   | ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
   | 1     | What's already there | Where a thing sits, its order, its size, its state, a control's own label: the frame's progress says how far, the bottom bar says what's next. |
   | 2     | A mark               | An icon, a check, a dot, a ring, a kind's icon in its hue (`StatusMark`, `KindMark`, `DoneMark`).                                              |
   | 3     | A number or a meter  | A readout, segments, a bar, cells, a ring (`BigQuantity`, `MeterParts`, `StatTile`): [progress as data](../SKILL.md#zoonks-visual-language).   |
   | 4     | A label              | A word or a few that sit on one of the above: a unit after a number, a name beside a mark, a row's title.                                      |
   | 5     | A sentence           | Only what none of the above can say. A screen has room for one, and the sketch says what the learner would get wrong without it.               |

4. **What it leaves out,** and where each of those goes instead.

A day's end that has to tell the learner how much of today is done, what they earned and what comes next is the day's meter with one more part filled, the number earned as a readout, and the next block as the bar's action. It needs no sentence.

## Words belong to something

After the sketch, most words on a screen are labels: each sits on a mark, a number, a row or a control and takes its place in the hierarchy from it. A free line belongs to nothing: a sentence under the title, a line of facts, a caption, a caveat, a counter over the content, a text link between two blocks. Each one is another layer to read, and two of them one under the other is where a screen turns into text. So a screen has one free line at most, under its title. The next one becomes a label on something drawn, moves to its moment, or goes. Setting a line in a chip, in mono or in smaller gray doesn't make it a mark, and neither does setting a sentence under a row's title or under a number: it is still a line to read.

An icon earns its place by replacing words or by making a row findable without reading. One set beside a sentence that stays is decoration, and the screen is still its sentences.

This isn't a rule to strip screens. A screen cut down to a title and a button is as flat to a scan as a wall of text ([clean is not boring](../SKILL.md#zoonks-visual-language)): the facts are still owed, drawn.

## Draw it

Look at the sketch as a picture before anyone builds or briefs it. `pnpm design:sketch <file.html>` renders an HTML fragment written with the app's classes and tokens at phone size in a few seconds, with no server, and writes a squint copy beside it ([how](#the-sketch-tool)). Change the fragment until the picture passes the scan below, then build that. A debate's result and a build brief carry this picture ([what a debate about screens decides](../../../guides/design-debate.md#what-a-debate-about-screens-decides)).

## The scan

Asked of every new or changed screen, on its phone picture, before any other question and before any ruler. The builder asks it of the sketch; a reader who built none of it asks it again of the built screen ([the first-glance test](checks.md#the-first-glance-test)), on the squint copy first, where body text can't be read (`pnpm design:sketch --squint <picture>` makes one from any screenshot).

1. What do you see first, second and third, named as shapes (a big number, a bar, a row of marks, a button, a block of gray lines)? Is the first one the one thing?
2. How many free lines are there between the title and the main action?
3. For each piece of text, and each thing drawn: would the learner do anything differently without it? Could something drawn say it, or does something already say it?
4. Is there anything on it worth looking at, or is it only tidy?

Each answer that falls short is a finding against one of the rules below, and on a screen the change drew it is fixed like any named rule's ([the craft read](checks.md#the-craft-read)).

### V1. One thing first

One thing stands out before any word is read, and it is what matters most on the screen.

- **Check.** On the squint copy, name the strongest shape. A finding when it is the title alone over lines of one weight, when two things compete, or when nothing drawn is on the screen at all.
- **Usual break.** A title, gray lines under it, and the action far below across an empty screen.

### V2. Drawn before written

A count, a position, a duration, a share, a state (done, saved, next, locked) and a kind each have a mark, a number or a meter, and are written only as that piece's label.

- **Check.** Each piece of text outside the content: name the carrier above it in the order that would have worked. A fact both drawn and written, or written beside the control whose label says it, is a finding too ([once](words.md)), and so is one the learner doesn't need on this screen, drawn or written.
- **Usual break.** A bar and, beside it, a line that says the same position. A sentence that reports a state a mark shows everywhere else in the app.

### V3. One free line

Between the title and the main action, one line at most belongs to nothing drawn.

- **Check.** Count the free lines: sentences, facts lines, captions, caveats, counters and text links that aren't a label on a mark, a number, a row or a control. A sentence under a row's title or a number counts.
- **Usual break.** A chip, a counter and a title stacked over the content. A caveat added under a facts line to answer a finding.

## When a finding asks for more

A finding that a learner can't tell something is one fact back at the top of the carrier order, which is what [the fix order](words.md) walks: remove what needs explaining, rename it, let something already there say it or draw it, move it to the moment it matters. A sentence is the last answer, and it takes another one out. A screen that gained a line to answer a finding gets the scan again before the finding closes, since each line was asked for by someone and the pile is nobody's.

## The sketch tool

`pnpm design:sketch <file.html>` takes what goes inside `<body>`: plain HTML with the classes the app's pieces use (read the piece in `packages/ui`, `packages/learn` or `packages/player` and redraw it), since it compiles the app's `globals.css`. `<i data-lucide="clock" class="size-4"></i>` becomes that Lucide icon. It writes `<file>.png`, what a phone shows of the screen (390 by 844; it says so when the screen is taller), and `<file>.squint.png`, the same picture blurred until its body text can't be read: a title keeps its shape. `--dark` draws dark mode and `--squint <picture.png>` blurs any screenshot, such as a built screen's. It draws with the Chromium the E2E tests use (`pnpm exec playwright install chromium`). The fragment and its pictures stay outside the repository. A sketch shows structure and hierarchy; the built screen is still judged in the running app.
