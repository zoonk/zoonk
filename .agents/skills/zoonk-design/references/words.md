# Words

These rules are for the product's own screens: the app a learner operates, on the web, iOS and Android, and the tools staff operate. [Marketing pages](marketing-pages.md) do a different job and have their own standard.

A learner gives a screen about two seconds and knows only what earlier screens showed them. Write for that person, never for someone who knows how Zoonk works.

- **One message.** Before writing, finish this sentence: "This screen tells the learner ___ so they can ___." The title says it. Everything else supports it or leaves.
- **Words come last.** A screen's words are what is left once its [sketch](show-first.md#the-sketch) has given each fact its first carrier, so most are labels on something drawn. Between the title and the main action, one line at most belongs to nothing drawn ([V3](show-first.md#v3-one-free-line)): a sentence of 20 words at most that says what this is and why it's worth doing (a test's offer: what it finds and what the learner gets), or a line of three facts at most. That is a ceiling, never a slot to fill: a screen that needs no sentence has none. A list row is a title and at most one short line, and a result leads with one number. Need more? Make it a step, or put it behind one "Details" link.
- **The learner's words.** Use a product term (plan, focus, phase, time a day, Brain Power…) only on or after the screen that shows the learner what it is. Before that, say the plain thing ("how long you study each day"). The [English style guide](../../../../packages/i18n/.eloqnt/styleguide.en.md#plain-words-first) lists each term, where it's taught and the words learners never see. If a string needs a translator note to explain a word, the learner doesn't know the word either: rewrite the string.
- **Names wait for their screen.** A name is a term too ("your buddy", "Zu", "Plus", a feature's name): it appears only after the screen that introduces it. Until then we speak as "we" ("We break explanations into small steps"). The buddy is introduced on "Choose your buddy", the last of onboarding's questions about the learner, so every onboarding screen before it (the goal, the language, how to address you, what applies to you) and every marketing page say "we", never "your buddy" or its name.
- **What they get, not how it works.** Say what the learner gets and what to do. How Zoonk picks, counts, saves, schedules or estimates goes behind a tap (a number's sheet, "How this works"), for the few who ask. A question says what we'll use the answer for ("We'll adapt lessons to your needs"), never the list of what the system does with each answer.
- **Say it when it happens.** A caveat, limit or exception appears where and when it applies (the day a lesson moves, the question a test can't ask), not on the screen where the learner decides to start. Being true doesn't earn a line its place. Being needed now, to decide or to act, does.
- **Buttons are verbs they already know.** "Start", "Continue", "Skip", "Save", "Try again": a main action is one or two words, any other button three at most, in every language: a translation says no more than its English. A label never names the next screen, a term from a later screen, a duration or a consequence ("Continue to daily time", "Start the 20-minute test", "Archive and hide this goal"). If the consequence matters, the screen says it once, above the button. The one label that says its consequence is a test's way out, "Stop and use my answers" ([exceptions](craft.md#exceptions-the-user-granted)).
- **Once.** On one screen a fact is said once, unless a sentence needs it as its subject or it is a setting's own row: the Plan's header doesn't name the goal the top bar already names, and its Schedule number doesn't say "45 min a day" beside a "Time a day" row that says "45 min". A line that would repeat on every row goes to the list's header, or goes.
- **No bookkeeping.** Counts and system states ("Questions on 2 of 18 subjects", "lessons aren't written yet") appear only when they change what the learner does next.
- **A fallback is the next step.** When we can't do the usual thing and the learner loses nothing, say what happens instead ("We'll find your level in your first days"), never what we couldn't do: that reads as an error.
- **Examples travel.** A placeholder or an example is one a learner in any country knows, or it's written per market.

When a review or a walk finds that a learner wouldn't understand something, fix it in this order and stop at the first that works:

1. Remove the thing that needs explaining.
2. Rename it in the learner's words.
3. Show it: let something already on the screen say it, or draw it (a mark, a number, a meter, an example).
4. Move the explanation to the moment it matters.
5. Add a sentence, and take another one out.

A screen that gained a line this way gets [the scan](show-first.md#the-scan) again before the finding closes.

Internal tools (Admin, evals, the playground, the CLI) follow the same rules for a staff person: [internal tools](internal-tools.md).
