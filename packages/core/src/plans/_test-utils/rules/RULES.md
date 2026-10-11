# Learner-facing planning rules

The owner's rules for what a learner's plan does, written as checks a test or the learner simulator runs after every step of a learner's life. Each rule has the owner's words (or who decided it when there's no direct quote), a statement precise enough to check, what it reads, and its check. The decisions D1 to D11 (10 Oct) are folded into the rules; what is still open is listed at the end.

## Where this lives and why

The checks are oracles for tests and for the simulator: no product code imports them. They live in `_test-utils/rules/` because Knip's production mode exempts `**/_test-utils/**`; a `plans/_rules/` folder that only tests import would be reported as unused files.

## How to run them

`checkRules(context)` in `check-rules.ts` runs every check on one step and returns `RuleViolation[]` (`{ rule: "R3", message, details }`). Each check is also exported on its own. A check finds nothing when the step doesn't carry what it reads, so a caller passes what it has. A step that isn't the plan's (`accountDeleted`, `promptChanged`) runs only the shared content rules (R29 to R31): it passes the last plan without the proposals a plan's step carries, so the plan's checks would judge it again with less to read (career seed 2014 flagged R13 at the deletion).

The step (`RuleContext` in `rule-context.ts`):

| Field                          | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `today`                        | The learner-local day of the step, at UTC midnight, as the planner uses it.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `before`, `after`              | The saved plan the learner saw before the step and the one saved after it (`RulePlan`: goal, graph with each skill's lessons as the last build counted them, settings, prerequisites, topic levels, items in plan order, phases). `BuiltPlan.items` and `.phases` fit as they are; set stand-ins' `lessons` as `savePlanItems` does, or a stand-in counts as one lesson.                                                                                                                                     |
| `event`                        | What happened: `planCreated`, `learnerChange` (with its operations; `setBack` when the editor took it as the Undo of the latest edit), `placement`, `session`, `testOut` (each with the step's own `answers`), `newDay` (`studied` when the last study day had progress), `undo` (an applied change taken back, with `restores`, the plan right before it), `noticeEdition` (a new edition of the notice read; `changesPlan`), `outlinesLanded`, `refresh`, `examPassed`, `accountDeleted`, `promptChanged`. |
| `answers`                      | Every answer so far, oldest first: skill, right or wrong, true/false or not, where it came from, and whether a recording asked it.                                                                                                                                                                                                                                                                                                                                                                           |
| `declined`                     | Proposals the learner declined earlier on this plan (the understanding card's kept date as a declined `setNoticeDate`).                                                                                                                                                                                                                                                                                                                                                                                      |
| `waiting`                      | Proposals still waiting for the learner's answer after the step, as clients read them (Today's "Moving your phase dates" among them).                                                                                                                                                                                                                                                                                                                                                                        |
| `learnerChanges`               | Every change the learner made or applied on this plan so far, oldest first: its day and its operations (when they passed basics over).                                                                                                                                                                                                                                                                                                                                                                       |
| `changes`                      | Plan changes the step wrote or answered, as clients read them (`PlanChangeView`).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `learner`                      | Gap areas, areas they said they know, a class test's announced skills, skills a measured level (a language level test) places them past, skills the exam practices only with recordings, their personal texts (goal as typed, name, free answers, memory).                                                                                                                                                                                                                                                   |
| `sessions`                     | Every study session so far: its day and the skills its practice asked.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `finishedLessons`              | Every lesson the learner finished so far: its day, the skills it trained (the plan's skill it counts for and the lesson's own) and the day its end screen said it comes back (`comesBackOn`).                                                                                                                                                                                                                                                                                                                |
| `preparation`                  | The goal's preparation after the step: its value, coverage and test parts, the estimated score, and every finished mock (questions, one subject or not).                                                                                                                                                                                                                                                                                                                                                     |
| `todayShown`                   | Today's session was built before the step.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `view`, `syllabus`             | The plan view and the syllabus clients read after the step (only the fields the checks read).                                                                                                                                                                                                                                                                                                                                                                                                                |
| `shown`                        | Texts the learner was shown; `quoted` for text that reproduces a source.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `sharedContent`, `generations` | Shared Library rows before and after the step (`table:id` to version), and the AI tasks it started with their inputs.                                                                                                                                                                                                                                                                                                                                                                                        |

Words used below: a lesson "still to do" is a `todo` lesson item; a stand-in counts as its saved `lessons`. An area is the graph skill's area (`getSkillArea`). A notice topic is "in the plan" while any skill that teaches it has an item that isn't set aside for time (`skipped`): done and tested out keep it in, and a set-aside lesson is out of the plan, as the planner's `listPlannedTopics` and `listLessonsLeftOut` read it. R8 still counts a set-aside lesson as carried, not lost. A graph that maps no notice topics at all (a career's, a language's) names its skills as its topics, as plan changes do (`getSkillTopics`, mirroring the planner's `listPlannedTopics` in plan-effect.ts), so R3, R5 and R15 compare skill names there. "Out by choice" means an area the learner took out, a base they chose to skip ("Skip"), or the basics (`getFoundationSkillIds`) of an area they said is too basic (`setAreaStart` with `pastBasics`, `settings.pastBasicsAreas`). Onboarding sets an exam's listening areas past the basics the same way for a learner who states an intermediate or advanced level or ticks listening among the subjects they know well, and placement does when its text answers confirm a level the areas' basics sit at or below (inside its tested-out change, so Undo takes them back), unless the learner set a start for those areas (the lead, 10 Oct); the checks read the setting, not who set it, and a setting no change of the learner's names counts from the plan's first day, as the planner dates it. The last two are "passed over": explicit choices, so their lessons leave at once, but the skills stay "to confirm" (RULES 4). Nothing else the learner only said they know (a subject, their level) leaves the plan without its own answers (D9).

## A. What a learner's change does

### R1. A focus never shrinks the focused area

- **Owner's words:** none direct; in the round 13 brief, and the round 12 FIXES 2 reading the orchestrator accepted: "'More X' means more lessons when time is short, and X done sooner when every lesson fits."
- **Check:** after a change made only of `focusAreas`/`reduceAreas`, each focused area (or the part the change or the plan names) has at least as many lessons still to do as before, and with as many, its last one is due no later. When the change adds areas to the focus (areas not in `before.settings.focusAreas`), an area focused before that it keeps focused may share with them when the card says what it gives: fewer lessons through an `areaLessons` line, a lesson of it in `lessonsLeftOut` or its topics in `topicsLeftOut` (an end date alone doesn't say it has fewer lessons), or as many done later through an `areaEnds` line (from the lead's fresh-eyes walk, 10 Oct: Ana's "math and natural sciences" was refused with "Nothing changed" because math would give some depth, though natural sciences gained 10 lessons). The added areas, and every focused area when the change adds none, are held as before. Left out when a test is 7 days away or less (a focus orders that review instead).
- **Reads:** `event.operations`, `before.items`, `before.settings.focusAreas`, `after.items`, `after.graph`, `after.settings.focusParts`, `changes` (the applied card).
- **Code:** `checkFocusKeepsArea` (steering-rules.ts).

### R2. Less of an area takes from that area

- **Owner's words:** round 13 brief ("reduce takes from the named area"), FIXES 2 ("'Less Y' means fewer lessons when short, and Y done later when it fits"); D5 (10 Oct): "Unnamed areas may shift only by rounding, at most 2 lessons each, and the card names only X and Y. Any larger move to an unnamed area must appear on the card." The lead (10 Oct): "A 'reduce X' that can't take anything because everything fits is allowed when the card says X keeps all its lessons and its end date because everything fits. The stored reduce applies once time gets short. An inert reduce the card doesn't mention is still a violation."
- **Check:** after a steering-only change that reduces areas: each reduced area has fewer lessons still to do, or as many due later, or the card of the applied change says it keeps all its lessons and its end date because everything fits (an `areaEnds` entry whose day doesn't move; the stored "less" applies once time gets short). An inert "less" the card doesn't mention is a violation, unless the area has no lesson left to do (done or tested out): it has nothing to give. Each area the change doesn't name moves by at most 2 lessons still to do (with "less" alone, it may also gain the time freed), unless the card of the applied change names it: in `areaLessons` (D5's line, "44 lessons to go instead of 40"), `areaEnds`, `areaStarts`, `topicsAdded`/`topicsLeftOut`, or by a lesson of it in `lessonsLeftOut`.
- **Reads:** as R1.
- **Code:** `checkReduceTakesFromArea`.

### R3. A card says what the change did to the saved plan

- **Owner's words:** "never claim something about the plan that isn't true" (round 11); "cards/previews equal the diff of the saved plan" (round 13 brief).
- **Check:** for the change the learner applied in the step, its effect equals the diff of the saved plan before and the one saved after: `lessonsAdded` and `lessonsRemoved` counted skill by skill, a lesson both plans hold counted under the skill the learner saw it under (a lesson two skills share is the same lesson wherever the new plan files it; Câmara seed 2009); `lessonsLeftOut` (lessons whose lesson, or stand-in's skill, is gone or set aside), `topicsLeftOut` and `topicsAdded` as sets; each `areaEnds`/`areaStarts` entry's days; each `areaLessons` entry's lessons still to do in the area before and after (a stand-in counts as its saved lessons); every steered area whose last lesson moved appears in `areaEnds`; `addedTopicsStart` is the first due lesson of the skills an `addSkills` operation adds. Not checked: `endDateBefore`/`endDateAfter` (the graph-sized end, not an item's day) and `todaySession`.
- **Reads:** `changes` (the applied one), `before`, `after`, `event.operations`.
- **Code:** `checkCardMatchesPlan` (change-truth-rules.ts).

### R4. A change of focus keeps today as the learner saw it

- **Owner's words:** D6 (10 Oct): "after a focus change, today keeps its lessons in order, and focused lessons come after them" (pass 10 problem 2, Sofia's day reopened with Processo Penal).
- **Check:** after a steering-only change while today's session was shown: today's lessons still to do stay, in their order, but those of reduced areas (which may leave); every lesson that comes into today is a focused one, after the ones that stayed. With "less" alone (no focus), the time it frees today may go to the lessons next in the plan, after the ones that stayed, as R2 lets unnamed areas gain the time freed; a lesson of a reduced area never comes in (OAB seed 1006).
- **Reads:** `todayShown`, `today`, `before.items`, `after.items`, `event.operations`.
- **Code:** `checkSteeringKeepsToday`.

## B. The plan doesn't change behind the learner's back

### R5. Every change is recorded and said

- **Owner's words:** "plans adapt to progress but never change without progress or a learner action" (7 Oct); D8 (10 Oct): "every visible change to which topics are in the plan, whether from placement, a session, a refresh or a learner change, is recorded and said, naming the topics"; D11: "a missed-day change names the topics it leaves out".
- **Check:** for any step but plan creation, deletion or a prompt change: every notice topic that leaves the plan or comes into it is named by a change the step recorded (`effect.topicsLeftOut`/`topicsAdded`). Saying the plan covers less (`behind`) doesn't name them. A learner's change with a card is checked by R3 instead, and an undo by R38. An undo, the editor's Undo of the latest edit (`setBack`) included, takes back what that change's card named, so it isn't checked here. A graph without notice topics names its skills: each skill that leaves or comes in is named the same way (D8 holds for careers and languages too). A tested-out item keeps a topic in the plan but never brings one in: a skill out for time that a right answer settles gets a tested-out stand-in, so no re-plan brings it back, and the test-out's own change announces it.
- **Reads:** `before`, `after`, `changes`.
- **Code:** `checkChangesSaid` (stability-rules.ts).

### R6. Shown phase ends don't move through system changes

- **Owner's words:** the owner chose option A (8 Oct): shown phase end dates stay fixed through system refreshes, the difference is absorbed inside the phase, and a goal date at risk becomes a Today proposal.
- **Check:** across a `refresh`, `outlinesLanded`, `session` or a `newDay` the learner studied, each phase still ahead keeps its end date. A learn plan's last phase with dates, before or after the step (its end is the plan's finish; phases a date cuts short have none; a phase the learner finished shows the days it was finished on, R39, so the last one before it with work is the finish: language seed 2011), and an after-exam phase are left out. So a phase that becomes the last because the phases after it left for time may end on the new finish. A phase that lost its dates with nothing left to do left the plan for time: R5 judges whether the change names its topics. One that lost its dates with a lesson still to do is flagged. A phase the learner finished (nothing of it left to do) is left out: it shows the days it was finished on, as R39 allows, not a date still ahead of them (language seed 1083: lessons of two later phases finished ahead). A learner's change, a missed day and a test-out may move them.
- **Reads:** `before.phases`, `after.phases`, `after.items`, `event`, `today`.
- **Code:** `checkPhaseEndsKept`.

### R7. Today's session doesn't change under the learner

- **Owner's words:** pass 7 R1 "Today must never change under the learner"; round 9 R9-TODAY "system refreshes never remove/reorder blocks (append landed lessons at end within time)".
- **Check:** once today's session was shown, a `refresh` or `outlinesLanded` keeps every lesson of today still to do, in the same order (a stand-in's landed lessons take its place), and puts new ones after them.
- **Reads:** `todayShown`, `today`, `before.items`, `after.items`.
- **Code:** `checkTodayKept`.

### R8. Work carries over

- **Owner's words:** "Unfinished work from a past day carries into the next session (no gaps)" and plans "never drop unfinished lessons" (7 Oct); every change "re-plans from today: past work never moves" (the change contract).
- **Check:** after any step but the learner's own change, every lesson an earlier day left to do is still in the plan (still to do, done, tested out or set aside: when missed days leave no time for it, it's set aside as `skipped` and the change names its topic, D11, never deleted); from an exam's day on nothing is left to carry it to, unless the plan studies everything past the date (`fullCourse`). After any step at all, everything the learner finished is still there, finished. Items are matched as the planner's `getItemKey` does: a boss by its phase, a chapter by its chapter, so a finished boss dated to another day isn't lost work.
- **Reads:** `before.items`, `after.items`, `today`, `event`.
- **Code:** `checkUnfinishedKept`, `checkFinishedKept` (work-rules.ts).

### R9. A studied day isn't a missed day

- **Owner's words:** round 11 brief: "a studied day with unfinished lessons is not a missed day (unfinished work carries over)".
- **Check:** what the learner sees of it is checked by R6 (phase ends stay after a studied day) and R8 (its unfinished lessons carry over). There's no check of its own: the code records every settle as a `missedDays` change, a name no screen shows as missed days (the card says "Lessons earlier days left come first"), so a check on the name would report something no learner sees.

### R10. A learner's change keeps the chapter in progress first

- **Owner's words:** round 11 brief: "A learner plan change must never push out the chapter in progress; it finishes first, then the added topic starts on the card's date."
- **Check:** the chapter of the last finished lesson, while it has lessons left: after a learner's change (one that doesn't take its area out), each of its remaining lessons is still in the plan, and no lesson of its phase that was due after its first remaining lesson is now due before it. A lesson of another area counts only when the chapter's first remaining lesson is now due later than it was: an exam's study cycle gives each subject its turn every day, so another subject's turn before the chapter's next lesson doesn't push the chapter out (Câmara seed 1005). A chapter whose skill the change passes over by choice (a base skipped, the basics of an area the learner calls too basic) leaves with it, as a change that takes its area out does: the learner chose it and the card names its lessons (class test seed 1180).
- **Reads:** `before.items` (`completedAt`, `chapterId`), `after.items`, `event.operations`.
- **Code:** `checkChapterInProgressKept` (work-rules.ts).

### R32. A run with nothing new changes nothing

- **Owner's words:** "plans adapt to progress but never change without progress or a learner action" (7 Oct). (Added after the others, so numbered out of order.)
- **Check:** a `refresh` (the app opened again with no progress, no lessons landed and no change) leaves every item with the status and the day it had, loses none and adds none (items matched by `getRuleItemKey`; details count `moved`, `lost` and `added` apart). Progress is new: the first run to see what the learner finished since the plan was last planned (`event.progressed`: a partial session plans nothing, and an open that settles nothing doesn't plan) may adapt to it (class test seed 1113: lessons done ahead in a partial session freed the time that brings a lesson cut for time back after the week).
- **Reads:** `before.items`, `after.items`, `event`.
- **Code:** `checkRefreshChangesNothing` (stability-rules.ts).

### R33. A declined proposal isn't offered again until something new happens

- **Owner's words:** D7 (10 Oct): "a declined proposal isn't offered again until something new happens, such as a new edition, a new date, or new progress that changes the answer." The lead (10 Oct): "a new edition counts as something new. Offer a declined notice change once per edition."
- **Check:** no proposal the step makes has the kind, operations, effect and official date of one the learner declined (something new changes at least one of them), except on a `noticeEdition` step (a new edition of the exam's notice was read). On such a step, when following the edition changes the plan (`changesPlan`) and the learner declined a notice change before, the step proposes a notice change.
- **Reads:** `changes` (the proposed ones), `declined`, `event`.
- **Code:** `checkDeclinedNotReoffered` (proposal-rules.ts).

### R38. Undo gives back the plan the learner had

- **Owner's words:** "plans adapt to progress but never change without progress or a learner action" (7 Oct). Undo is the learner asking for the plan they had before a change, so it may change nothing that change didn't. Found by the learner simulator's undo probe (10 Oct): 6 of 19 undos made right away moved items and phase ends.
- **Check:** after an `undo` of an edit or a test-out, every item of the plan right before the undone change (`event.restores`) is in the plan with the status and the day it had, the plan holds nothing else, and each phase that hasn't ended ends where it did. Items matched by `getRuleItemKey`; details count `moved`, `lost` and `added` apart. A lesson the learner finished since the change stays done, and an item due on a day now past may come back from today on. The caller passes an undo only when nothing but finished lessons happened since the change (an edit can be undone only while the plan is as it left it). R5 doesn't apply: the undone change's card named what comes back.
- **Reads:** `event.restores`, `before.items`, `after.items`, `after.phases`, `today`.
- **Code:** `checkUndoRestores` (stability-rules.ts).

## C. What a plan keeps when time is short

### R11. Every topic's core before any depth, most asked first

- **Owner's words:** "core of every topic before any depth, cuts from least-asked (depth first, then whole topics); line true by construction" (9 Oct ~11:20); "Cuts when time is short: decide from the learner's point of view." The lead (10 Oct): "A topic the teacher announced for a class test counts as certain to be asked, so it ranks above any unannounced topic when the plan cuts for time. Among announced topics, and among unannounced ones, most asked comes first." The lead (10 Oct, on a top topic whose bases don't fit): "Don't spend the time on bases of a topic the plan won't reach, unless those bases are asked topics themselves. Give that time to the next-ranked topic that fits whole, and have the change name the cut topic." On a skill answered right, wrong, right: "A miss anywhere means it isn't known (D2), so it's a gap."
- **Check:** within a subject (or the part of it a focus names), a notice topic out of the plan for time (cut, or set aside as `skipped`) never ranks above topics whose skills keep lessons still to do when it would have fit whole in their time: its need (the core of the skill that teaches it at least cost, plus the core lessons each base that skill builds on still misses in the plan: a base held in part, such as a stand-in at 7 of a 10-lesson core, misses 3; a base in the skill's own subject that the learner started misses the core lessons they haven't done and the plan doesn't hold, since the study cycle places a subject's base cores first (Câmara seed 2141); one in another subject only has to be started, and a tested-out one misses none; a core is a third of a skill's lessons, at least one, its lessons as the plan's last build counted them (`graph.skills[].plannedLessons`, `listSkillSizes`; the graph's estimate for a plan saved before builds counted them); one skill brings a topic in, and a second skill of it comes only after every topic has one, as the planner ranks cores) is no more than those skills' lessons still to do. Skills the cut topic builds on and bases (transitive prerequisites) of a skill in the plan ranked at least as high don't count among them. A topic too big for the time may go while the next-ranked ones that fit whole keep it; the change names it (R5). And no skill that no notice topic asks keeps lessons when only cut topics build on it: time on the way to a topic the plan won't reach. A topic the learner showed they know (every skill teaching it in `learner.knownSkillIds`, none missed anywhere) ranks below every topic they don't know, and a kept skill they know ranks as known: a plan short on time cuts it first and practice keeps it (Câmara seed 2006). Known takes R17's evidence: a right answer of the skill's own, two when the learner focused on it, three when true/false, and no wrong one (the lead, 10 Oct: "that one definition covers the cut, test-out and the syllabus label"; one predicate in the claim model, which R11 and R17 read). The known set is the one the planner read when it last built the plan: the lead (10 Oct) "R11 ranks with the known set the plan was last built with", so a skill a step's answers make known after that run counts from the next build. A skill whose test-out the learner undid isn't known until a later answer of its own: the learner asked to study it, so the cut never takes it back as known. Among the rest, a topic a class test's teacher announced ranks above any unannounced one (the lead, 10 Oct: "it counts as certain to be asked"); among announced topics, and among the others, most asked first, then what the learner missed (any wrong answer on the skill, placement included, even when a later one was right). A topic is announced or missed when any skill that teaches it is; a skill that keeps lessons ranks as the highest of the topics it teaches, each ranked that way, so the one way in to an announced topic ranks as announced. Skills out by choice, tested-out ones, ones in progress and skills without notice topics (beyond the notice, or learner-added) don't count. Depth cuts aren't checked. A session's run keeps this week as the learner saw it (`keepThisWeek`), so the lessons it kept this week aren't time a cut topic could take: a missed topic left out waits for the week after (class test seed 1212). A later step that leaves every item as it was ran nothing, so R11 reads that week as the run left it (class test seed 2148: the next morning had nothing to settle). A known edge: before a test this week, a known skill's kept lessons can hold the time a missed topic needed. An undo gives back the plan as it was built, which R11 judged then: R38 checks the undo (ENEM seed 2061: undoing placement's test-outs gave back the plan built before its misses).
- **Reads:** `after.topicLevels`, `after.graph`, `after.items`, `after.prerequisites`, `after.settings`, `learner.announcedSkillIds`, `learner.knownSkillIds`, `answers`.
- **Code:** `checkMostAskedKept` (most-asked-rules.ts).

### R12. An exam's written tests are always in

- **Owner's words:** "the discursive test always in" (6 Oct); the owner (7 Oct) wants a learner-chosen cadence for written practice, "they may want it only in the final weeks". "From week one" is the round 7 planner rule for the default cadence.
- **Check:** every written-test area (all skills outcome, `getWrittenTestAreas`) not taken out has a lesson in the plan; a new plan with weekly cadence and the exam more than 14 days away has one due in its first 7 days.
- **Reads:** `after.graph`, `after.items`, `after.settings`, `event`.
- **Code:** `checkWrittenTestsKept` (keep-rules.ts).

### R13. A career goal keeps its outcome work

- **Owner's words:** decided on the owner's behalf (6 Oct): "career goals always include portfolio and job search (never trimmed first)"; owner (7 Oct): "Career plans weave the portfolio in from the start when the goal calls for it."
- **Check:** in a goal that isn't an exam, every outcome skill not out by choice has a lesson in the plan. A system run never moves a phase end the learner saw (the lead, 10 Oct), so when the job search doesn't fit with the ends kept, an outcome skill may be out while Today's proposal to move the phase dates (`fitPhaseDates`, starting from the ends shown) waits and its card names it (`effect.outcomesAdded`, the outcome skills moving the dates fits in, by name; career seed 2014), or after the learner declined that card ("Keep mine", starting from the ends they saw): the learner's informed choice over what it named, like one out by choice (the lead, 10 Oct). An outcome skill the declined card didn't name isn't covered: Today asks again (`isKeptOver`). Judged at the step: the run that leaves job-search work out writes that proposal itself, so the learner never sees outcome work cut without a card saying why (the lead, 10 Oct).
- **Reads:** `after.graph`, `after.items`, `after.settings`, `after.phases`, `waiting`, `declined`.
- **Code:** `checkOutcomesKept`.

### R14. Studying everything leaves nothing out

- **Owner's words:** "an option where users don't set a deadline and instead they choose to do the full course. so, this would be open-ended without deadlines" (9 Oct).
- **Check:** a plan without a date, or an exam plan with `fullCourse`, has a lesson for every graph skill not out by choice. A skill whose Library lessons the plan holds under another skill that shares them (the planner files a shared lesson under one skill, `assignLessonSkills`) is planned: its lessons are in the plan, to do, done or tested out, and no card should call it left out (career seed 2042). The check can't see that filing yet (the step carries no lesson-to-skills map), so it still flags such a skill: a known edge, rare (a landing whose lessons are all another skill's).
- **Reads:** `after.goal`, `after.settings`, `after.graph`, `after.items`.
- **Code:** `checkEverythingPlanned`.

### R15. A base choice never pushes out a topic

- **Owner's words:** prerequisites are the learner's choice (9 Oct); the choice's contract: "No choice ever pushes out a topic its core keeps."
- **Check:** after a change made only of `setBaseChoices`, the only notice topics that leave the plan are topics of the bases it sets to `skip`. The plan with every base at its core is what no choice pushes a topic out of, so a change that takes back the time a choice cheaper than a base's core freed (a quick lesson or a skip that becomes its core or deep study, read from `before.settings.baseChoices`) may let go of a topic only that spare time held (class test seed 1117: back from quick to its core, the base took the time that kept the nucleus, which the core plan never did). R11 judges which topic goes (the least ranked first) and R3 that the card names it. Core to deep study takes only the time left, so it lets nothing go. The lead (10 Oct, class test seed 1255: a quick lesson for a finished base swapped cell theory for osmosis): "A base choice on a base with nothing left to study is a no-op" with the "already in your plan" card, and "on a change made only of base choices, set-aside work comes back only if it costs no topic the plan holds" (other learner changes bring it back to compete). So a change whose choices are all for bases whose core the learner studied, none of their lessons still to do, short of deep study, leaves every item as it was, read as the planner reads it (`listStudiedCores`, the lead, 10 Oct: one check for both): a quick lesson done is no studied core, so a core asked for after it brings lessons back (Câmara seed 4). Work set aside before comes back on a base choice only while no topic leaves. The editor's Undo of a base choice (a change that sets back by hand what the latest edit changed, `setBack`) gives back the plan before that edit, so it isn't checked here (the lead, 10 Oct; class test seed 54).
- **Reads:** `event.operations`, `event.setBack`, `before` (with its `settings.baseChoices` and `taughtBy`), `after`.
- **Code:** `checkBaseChoicesKeepTopics`.

### R16. What a skill builds on comes first

- **Owner's words:** none direct; the graph is "in teaching order: prerequisites always come first", and prerequisites are hard dependencies only (round 11).
- **Check:** for two skills neither of which the learner began, a prerequisite with lessons in the plan has its first one due no later than the first lesson of the skill built on it. A skill is begun when one of its lessons isn't to do, or when a lesson the learner finished teaches it, whichever skill its item counts it for: the chapter in progress goes on after a lesson that also taught what its next lesson builds on (language seed 1001: the rent lesson, counted for another skill, also taught asking the rent, which booking a visit builds on), and so does a guest's first lesson once a plan exists.
- **Reads:** `after.prerequisites`, `after.items`, `after.taughtBy` (the Library's lesson links).
- **Code:** `checkPrerequisitesFirst`.

## D. Known topics and reviews

### R17. A topic is known only from its own answers

- **Owner's words:** "Known topics (one right answer) skip lessons but keep practice; a miss in practice brings the lessons back" (8 Oct). D2 (10 Oct): "A right answer on a skill may mark its direct prerequisites as 'to confirm', never as known. Lessons for a skill are skipped only after its own answers confirm it." D9: "No skipping basics on a self-claim alone. 'I know this well' marks them 'to confirm', and practice confirms them." The lead (10 Oct): D9 covers the level stated in onboarding: "Lower bands become 'to confirm': placement checks them early, confirmed ones are skipped, and misses bring lessons back. Only an explicit base choice 'Skip' removes them without evidence." Round 11 planner decisions: a focused topic needs 2 right answers of its own, true/false about 3. The lead (RULES 4): "'Too basic' works like 'Skip'. It's an explicit learner choice: the lower-band lessons leave right away and the card names them. The skills don't become known. They're 'to confirm', so they come up in practice, and a miss brings their lessons back with a change that names them. The same holds for bases set to 'Skip'."
- **Check:** each skill a step (a new plan, placement, a session, a test-out, a learner's change) takes as known, with every one of its lessons tested out, has among `answers` a right answer of its own (two when the learner focused on it, or three true/false) and no wrong one anywhere. A lesson's checks are part of learning it, not a test, so they count neither way, as the claims read answers (`loadAnswerEvents`). Nothing else counts: not answers on other skills, not a subject the learner says they know, not a stated level, not a choice to pass basics over. A measured level is a test of its own (the lead, 10 Oct: "A measured level counts as evidence"): units below a language level test's band (`learner.measuredSkillIds`) may be tested out, with the undo, and still get practice (R18) and come back on a miss (R19).
- **Reads:** `answers`, `before.items`, `after.items`, `after.settings.focusAreas`/`focusParts`.
- **Code:** `checkKnownHasEvidence` (known-rules.ts).

### R18. Known topics keep practice

- **Owner's words:** "Known topics (one right answer) skip lessons but keep practice" (8 Oct); D1 (10 Oct): "Known topics join mixed practice on the same spaced schedule as studied topics, starting about a week after they're confirmed. Each known topic gets at least one practice question within its first two weeks."
- **Check:** for a known skill (every lesson tested out, confirmed on the day the first was), once 14 days have passed: if the learner studied in the second week, some session since it was confirmed asked it in practice. The same holds for a skill passed over by choice and still to confirm (no lesson of it to do, studied or tested out), counted from the day the learner chose it: their latest change that passed it over, or the plan's first day for a choice made while setting it up (RULES 4; the same two weeks as D1 is our reading of "they come up in practice"). The "about a week" start isn't checked. A skill of an area the learner took out (`skipAreas`) is left out: the area stays out, practice included. A review asking it counts as practice: a free exam plan past its trial has no mixed practice, so its quick review asks the known topics due to be confirmed (the lead, 10 Oct).
- **Reads:** `sessions`, `after.items` (`completedAt`), `after.settings`, `learnerChanges`, `today`.
- **Code:** `checkKnownGetsPractice` (known-rules.ts).

### R19. A miss on a known topic brings its lessons back

- **Owner's words:** "a miss in practice brings the lessons back" (8 Oct); the lead (RULES 4): for basics passed over by choice, "a miss brings their lessons back with a change that names them".
- **Check:** after a step whose own answers include a wrong one on a skill whose lessons were all tested out (even after practice answered it right: a tested-out topic was never studied, so a miss means the test-out didn't hold, unlike forgetting a studied one), or one passed over by choice and still to confirm, the plan has lessons still to do on it, and a change the step recorded names it among `effect.topicsAdded` (by a notice topic of it, or its name when it has none, as `bringBackMissedLessons` names it). A miss on a skill of an area the learner took out brings nothing back: the learner's explicit choice stands (sessions don't ask those skills; IELTS seed 1012).
- **Reads:** `event.answers`, `before`, `after.items`, `changes`.
- **Code:** `checkMissBringsLessonsBack`.

### R37. A listening skill is asked only with recordings

- **Owner's words:** the lead's decision (10 Oct): "listening-area skills are practiced only with recordings (no text 'conversation' items; picking skips them; they wait while other skills fill the day)". A text question about a conversation tests reading, not listening.
- **Check:** on a skill the goal's exam practices only with recordings (`learner.listeningSkillIds`, from `getListeningSkillIds`: the skills in a listening section's area of a language exam with a public notice), the step's own answers include no question that isn't a recording's (`recording`), lesson steps aside. Placement asks text questions one at a time, so it never asks such a skill. No step takes it as known (every lesson tested out) without a right answer to a recording's question. That it waits while no recording is ready isn't checked.
- **Reads:** `learner.listeningSkillIds`, `event.answers`, `answers`, `before.items`, `after.items`.
- **Code:** `checkListeningOnlyRecorded` (known-rules.ts).

### R42. A finished lesson comes back when its end screen said

- **Owner's words:** the lesson's end screen says when it comes back ("next review", `getLessonComesBack`: the first of its skills the memory model makes due); "never claim something about the plan that isn't true" (round 11). The lead (10 Oct): a studied skill gets its first review or practice on the schedule the learner was promised.
- **Check:** for each lesson the learner finished whose end screen gave a day, by the second study session on or after that day (a day's reviews have a cap, so a full day may hold it to the next), some session after the day they finished it asked a skill the lesson trained, in a review or in practice: the plan's skill it counts for or one of the lesson's own, where its answers land. A lesson of an area the learner took out is left out (practice leaves that area out), and so is one whose end screen gave no day. Found by the learner simulator (10 Oct): answers land on a lesson's own skills while reviews and practice read only the plan's, so in a plan whose lessons teach finer skills of their own nothing studied came back.
- **Reads:** `finishedLessons`, `sessions`, `after.settings`.
- **Code:** `checkFinishedLessonsComeBack` (review-rules.ts).

## E. Days and exams

### R20. Day one always has a session

- **Owner's words:** "Day one always has a session" (5 Oct).
- **Check:** a new plan has something still to do on its first day (`settings.startDate`, else today).
- **Code:** `checkDayOneHasSession` (day-rules.ts).

### R21. Rest days rest

- **Owner's words:** a weekday at 0 minutes "makes a rest day"; "mocks respect rest days" (orchestrator, round 8).
- **Check:** nothing still to do is due on a weekday with 0 minutes, except the plan's first day (it always has time), a weekly event the learner moved there, and a phase's challenge held on the end the learner saw: a system run never moves a shown end (the lead, 10 Oct), so while Today's proposal to move that end (`fitPhaseDates`, its `effect.phaseEnds` starting from it) waits, or after the learner declined it ("Keep mine", starting from the ends they saw: their informed choice, the lead, 10 Oct), the challenge may stay on a day they now rest. "Keep mine" counts only on a card whose move of that end said the challenge falls on a rest day (`restDay`), as the planner reads it (`isKeptOver`). Lessons on that day are still flagged.
- **Reads:** `after.settings.weekdayMinutes`, `movedEvents`, `startDate`, `after.items`, `after.phases`, `waiting`, `declined`.
- **Code:** `checkRestDaysRest`.

### R22. Day one opens with what the learner doesn't know

- **Owner's words:** none direct; pass 7 R2/R7 ("Rafaela's weak English is on day one") and the round 9 day-one order "gaps → notice parts not known → known → beyond notice" (orchestrator).
- **Check:** in a new plan, when the learner has gap areas with lessons in the plan, day one's first lesson is in one of them; no lesson of an area they said they know comes before a lesson of a notice area (one whose skills have notice topics) they didn't say they know. Areas beyond the notice may come after the known ones.
- **Reads:** `learner.gapAreas`, `learner.knownAreas`, `after.items`.
- **Code:** `checkDayOneOpensWithGaps`.

### R23. The day before a test is a review

- **Owner's words:** "class test's last day is a full review" (round 13 brief); "free class-test last day = real review session" (round 8 decision).
- **Check:** for an exam with a date (when the plan starts before that day and it isn't past): no lesson still to do is planned ahead on the day before (once that day comes, the lessons on it are the ones earlier days left, which Today offers after the review, "if you have time"); a class test (`shortMockMinutes` set, 7 days away or less) has its mock or a review that day.
- **Reads:** `after.goal`, `after.settings`, `after.items`, `today`.
- **Code:** `checkDayBeforeTest`.

### R24. Every exam plan has mocks

- **Owner's words:** "every phase has mocks, including after the exam date" (9 Oct); D3 (10 Oct): "An exam plan with at least 3 study days before the exam has at least one plan mock. Anytime mocks are always available, so shorter windows rely on them." The lead (10 Oct): 14 days is the cut, and phases after the exam date are exempt.
- **Check:** an exam plan with at least 3 study days left before the exam (from its first day, or today once the plan has begun) has a mock before the exam, a mock it held on a day that has passed counting too; with fewer left, a mock the learner missed may leave and anytime mocks remain (ENEM seed 2060: the mock two days before the exam missed, gone the day before); each phase before the exam spanning 14 days or more has a mock inside it while it has days left (the final stretch included); a plan without a date has one once it spans 14 days. Shorter phases rely on anytime mocks, and the phase after the exam of a plan that studies everything is exempt. A phase that ended before today owes nothing more: a mock the learner didn't take there may leave, and the phase they are in has its own (ENEM's foundations mock missed in 5 missed days). From the exam's day on the check rests: no day is left before it, and a mock the learner didn't take may leave.
- **Reads:** `after.phases`, `after.items`, `after.goal`.
- **Code:** `checkMocksInEveryPhase`.

### R39. Phases keep their order

- **Owner's words:** "never claim something about the plan that isn't true" (round 11); the Journey shows the phases as a path, each ending with its challenge. Found by the learner simulator (10 Oct): a career plan dated its sixth phase before the second, and an undo left a language plan's fourth phase ending before its second.
- **Check:** among the phases with dates and something still to do (an item of the phase still `todo`), each starts no earlier and ends no earlier than the one before. A phase the learner finished (every item done or tested out) may show the days it was finished on, wherever they fall.
- **Reads:** `after.phases`, `after.items`.
- **Code:** `checkPhasesInOrder` (day-rules.ts).

### R40. A phase's challenge comes after its own lessons

- **Owner's words:** none direct; the Journey shows each phase "ending with its challenge", and the lead (10 Oct, asking for a simulator scan): a challenge that tests content the learner hasn't studied yet is a finding. The lead's choice (10 Oct): after a missed day, an end whose challenge would come before its phase's core lessons moves to just after them.
- **Check:** a phase's challenge still to do (`boss`) is due no earlier than the core lessons still to do of the skills it owns, wherever the plan dated or filed them. A challenge owns the skills it asks, read from the product's own rule (`getBossSkillIds`, the lead's (a), 10 Oct: its phase's skills, each first planned in it, whose core lessons come by its day; with none, the skills begun by its day), and, when the plan's phases come from the skill graph (a learn plan, an exam without a date), the skills of its graph phase (10 Oct: lessons that no longer fit before a kept end are filed under the next phase's time, so career seed 1027 had all 13 lessons of one phase after its challenge, filed under the next). An exam plan with a date has time-boxed phases that have nothing to do with the graph's, so only the first applies there: a skill begun late in a window waits for a later challenge (every exam plan asked one before its core at creation). A skill its exam practices only with recordings (`learner.listeningSkillIds`) isn't asked by a challenge with written questions; only a phase of those skills alone is asked with recordings (`loadBossQuestions`), so it counts only then (IELTS seed 1107: listening lessons after phase 1's written challenge). A skill's core is its first lessons in the plan, done ones included, until they hold `getCoreLessons` of its lessons as the plan's last build counted them (`listCoreLessonItems`, `listSkillSizes`: `graph.skills[].plannedLessons`, one size for the plan, its challenges and the checks, the lead, 10 Oct; a stand-in counts as the lessons it plans. Career seed 2050: the graph guessed 7 lessons for a skill whose chapter has 6, so its third lesson is depth); the depth a plan short on time studies once every core is in may come later. A challenge held on the end the learner saw while Today's proposal to move that end waits, or after they kept it ("Keep mine") on a card whose move of that end said lessons it tests come after it (`lessonsFirst`), is left out, as in R21 (the lead, 10 Oct). So is a later phase's challenge while Today's proposal to move an earlier end so its lessons come first (`lessonsFirst`) waits: a phase's overflow spills a day into each later phase, moving that one end fits them all again, and the card truthfully names only it (language seed 2: applying it cleared phases 1 to 4). "Keep mine" on that card keeps the spill too, as the planner doesn't ask again (language seed 2090). Found by the lead's ask and the simulator's scan (IELTS seed 1011, whose landed lessons turned out to be depth).
- **Reads:** `after.items`, `after.graph`, `after.phases`, `learner.listeningSkillIds`, `waiting`, `declined`.
- **Code:** `checkChallengeAfterLessons` (challenge-rules.ts).

### R41. A landing moves only what it touches

- **Owner's words:** "plans adapt to progress but never change without progress or a learner action" (7 Oct); round 9 R9-TODAY "system refreshes never remove/reorder blocks (append landed lessons at end within time)". The lead (10 Oct): a landing or an answer moves only the items it touches, beyond the day's carry.
- **Check:** when the Library's lessons land in a run of their own (`outlinesLanded`), each landed skill's lessons take its stand-in's place: no lesson of another skill that was due after the stand-in's first day now comes before them (a lesson that no longer fits that day may start the next, IELTS seed 1). Every item of a skill whose lessons didn't land, and every item of no skill (a challenge, a mock), stays in the plan with its status, and none comes in (a landing never swaps topics); what is due before the first day a landed skill holds keeps its day. What comes after may move to fit lessons that take more or less time than their stand-in held, into a later phase's time too where a kept end holds (career seed 3: day one's landing moved 146 later items 1 to 5 days later, nothing lost). A practice day, a mock or a weekly challenge there is known by its date (`getRuleItemKey`), so it may move or give way (IELTS seed 2: the landed lessons took the review day after the plan's last lesson); R24 still holds the plan's mocks. A plan teaches a title once (`withoutRepeatedTitles`), so another skill's lesson whose title a landed lesson now holds leaves with it (career seed 1163: a lesson of user needs left once the problem-definition skill landed one with its title). Landed lessons that hold more than their stand-in did need time: in a plan without room, as many other lessons still to do may leave for it (R11 judges which, R5 that the change names their topics), but no more, and none comes in (career seed 1180: a 4-lesson stand-in landed as 7). Landed skills are the ones the plan held a stand-in for whose written lessons it now holds. Items matched by `getRuleItemKey`; details count `moved`, `lost`, `added` and the landed skills that start `late`. Today's session is R7's too. A landing in the day's first run settles the days before it (a `newDay`) and isn't judged here, nor yet a run an answer starts (10 Oct: OAB seed 2003 and Câmara seed 2001 swapped topics and moved landed lessons days away).
- **Reads:** `before.items`, `after.items`, `event`.
- **Code:** `checkLandingMovesOnlyLanded` (landing-rules.ts).

## F. What the learner is told

### R25. What the plan says it covers is true

- **Owner's words:** "never claim something about the plan that isn't true" (round 11); pass 9 showed "you can study every topic" next to "2 of 202 don't fit" (in Portuguese).
- **Check:** a syllabus topic shown as to study (or in progress) has a lesson still to do on a skill that teaches it; one in progress whose rest is out for time (its lessons set aside after missed days, `notPlannedReason` `time`) has none still to do; one shown out of the plan has none still to do or done; `feasibility.coreFits` never stands next to topics out for time; `fits` implies `coreFits`.
- **Reads:** `syllabus`, `view.feasibility`, `after`.
- **Code:** `checkCoverageTrue` (shown-rules.ts).

### R26. The recommended time covers the goal

- **Owner's words:** "by default recommend the daily minutes that cover 100% of the goal by its date" (7 Oct).
- **Check:** with the daily time at or above `recommendedMinutes`, the plan fits; the recommendation is never more than 240 minutes.
- **Reads:** `view.feasibility`, `view.schedule.dailyMinutes`.
- **Code:** `checkRecommendedTimeCovers`.

### R27. No em dashes

- **Owner's words:** user-facing copy has "no em dashes"; a quoted source keeps its own punctuation (orchestrator, round 11).
- **Check:** no shown text that isn't `quoted` contains an em dash (U+2014).
- **Code:** `checkNoEmDashes`.

### R28. Never promise a pass, score or job

- **Owner's words:** "Never promise a pass, score or job" (redesign decisions).
- **Check:** no shown text that isn't `quoted` matches the plain promise wordings in Portuguese and English ("you'll pass", "guaranteed approval", "guaranteed … job"). A heuristic, not a proof.
- **Code:** `checkNoPromises`.

## G. Shared content

### R29. Deleting an account keeps shared content

- **Owner's words:** "no shared/reusable content should be removed if a user is deleted. only their personal/private data should be removed" (9 Oct).
- **Check:** after `accountDeleted`, every shared row of `sharedContent.before` is in `after`.
- **Code:** `checkSharedContentKept` (content-rules.ts).

### R30. Shared prompts never carry the learner's own words

- **Owner's words:** "just don't pass personal data to shared lessons prompts, only to personalized ones. this is probably valid for all shared content" (8 Oct).
- **Check:** no input of a `shared` generation contains one of `learner.personalTexts` of 4 characters or more (case and accents ignored). The caller picks the texts (the goal as typed, the name, the city, a free answer).
- **Code:** `checkSharedPromptsImpersonal`.

### R31. A prompt change never rewrites shared content

- **Owner's words:** "i don't think we should rewrite existing content on prompt changes at all. that's unnecessary costs. if we do decide to reset existing content we can do it manually" (9 Oct).
- **Check:** in a `promptChanged` step (a learner whose content the Library holds, replayed on a new prompt version), every shared row keeps its version and no shared generation starts.
- **Code:** `checkNoRegeneration`.

## H. Readiness

### R34. Readiness counts only what the learner showed

- **Owner's words:** "Readiness must be strictly honest, including hard topics" (7 Oct); "coverage never counts test answers" (round 10); D10 (10 Oct): give the checks the preparation view.
- **Check:** preparation's coverage counts no more skills as studied than those with an answer in their lessons, a lesson the learner finished (the plan's skill it counts for: a lesson's answers land on finer skills of its own, or on none when a step names no skill and the lesson teaches several) or a right answer in practice (a session, a review, a mock).
- **Reads:** `preparation.components.coverage.studiedSkills`, `answers`, `finishedLessons`, `after.graph`.
- **Code:** `checkCoverageShown` (readiness-rules.ts).

### R35. Readiness never says more than the evidence

- **Owner's words:** as R34; "Solid", never "ready", and not before a test in real conditions (round 7 readiness rule).
- **Check:** preparation's value is never above its coverage, and reaches Solid (0.75) only after a test in real conditions (a mock, a full review, a weekly challenge).
- **Reads:** `preparation.value`, `.components`.
- **Code:** `checkReadinessHonest`.

### R36. An estimated score needs enough mocks

- **Owner's words:** "estimated score only as a range after a mock exam" (redesign decisions); pass 9: one 8-question ethics mock read as "68% to 100%".
- **Check:** an estimated score shows only as a range (low below high), when the latest three mocks hold at least 30 questions between them and not every one of them sat a single subject.
- **Reads:** `preparation.estimatedScore`, `preparation.mocks`.
- **Code:** `checkScoreEstimateEarned`.

## Decided and still open

The owner's decisions of 10 Oct, D1 to D11, are in the rules above: D1 makes R18 checkable, D2 and D9 are R17 (and R11, R14 through "out by choice"), D3 is R24, D4 (card end dates are estimates, said "around") needs no check, D5 is R2, D6 is R4, D7 is R33, D8 and D11 are R5, D10 is R34 to R36. The lead's answers of 10 Oct: D9 covers the stated level (except an exam's listening basics at a stated intermediate or advanced level, or with listening ticked as known, which onboarding passes over as too basic, and those at or below a level placement's text answers confirm), R24's cut is 14 days with after-exam phases exempt, and a new edition counts as new for R33. RULES 4: an area the learner said is too basic works like "Skip": its basics are out by choice (R11, R13, R14), never known (R17), still to confirm, so practice asks them (R18) and a miss brings their lessons back, named (R19). R3 checks that the change's card names what leaves.

Still open:

- **Lessons left out by band.** Plan items don't say a lesson's band, so no rule checks a skill's easier-band lessons: kept on the stated level (D9, `keepLevelBands`), left with "too basic" for a skill the plan keeps teaching at a higher band (`keepPastBasicsBands`), or back after a miss there. Placement's side of D9 is R17; the planner's side has no check here.

## Not checkable by code

- The buddy's statements agree with the app (pass 10: "no fixed count" for ethics vs the app's 8 questions): needs reading the answer's meaning.
- Lesson quality: pictures that teach, native visuals where they help, "Spot the AI's mistake" only in work courses, activity variety. These belong to evals.
- Plus features shown locked, never hidden, and copy tone: screen and E2E checks.
- Today's count matching the session's rows: needs the built session in the step (a later check once the simulator carries it).
