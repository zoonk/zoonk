# Persona catalog

Pick personas whose differences matter for the change. A persona is a person with a goal, a life and a history, not a test account, so walk as them: in their language, with their time, device and patience, knowing what they know and nothing more.

When an issue or feature has no persona that fits it well, add one here with the same fields, so the next walk can reuse it.

## Seeded personas (no AI cost)

The v2 seed writes these learners on every reset, at a realistic point of their plan: their history and this week are written by hand, and the rest of each plan is the one the planner makes from them. On the dev server, sign in with the account's email and the newest code for it in the dev mailbox; E2E builds also take the seed password (`packages/e2e/src/fixtures/personas.ts`). E2E tests use private copies through `asPersona` (`apps/main/e2e/learn-personas.ts`), so they can change the plan without touching the shared ones. For a walk that changes anything, use your own copy from the persona command. Writing the copies costs nothing, and opening their pages starts no AI. Changing a plan or opening a session block is a real learner's request, though: on a fresh dev database most of Ana's ENEM topics have no lessons yet, so her first plan changes write the coming weeks' lessons with real AI (about $4.30 the first time). Those lessons stay in the shared Library, so later copies on the same days reuse them at no cost.

| Persona | Account                  | Goal and situation                                                                                                                  | Watch for                                                                                                                                                      |
| ------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ana     | `v2-exam@zoonk.test`     | ENEM on a real one's skill graph (141 skills, about 3,800 lessons), Plus, four exam phases, weekly mock on Sundays, first mock done | Exam page, mocks and their progress, phase dates, honest estimates (about 1h35 a day for the whole exam), plan changes near the exam, a real-size plan's speed |
| Lucas   | `v2-buddy@zoonk.test`    | Quantum physics ideas without the math, 15 minutes a night, grown buddy, two Trickster checkpoints                                  | Short days, buddy and Trickster moments, motivation without guilt                                                                                              |
| Marcos  | `v2-language@zoonk.test` | English for a Toronto move, 25 minutes a day, A2 toward B1+ (more than his time reaches), mid-unit                                  | Calls, speaking and pronunciation, levels, unit order, a plan that honestly says his time doesn't cover his goal                                               |
| Maya    | `v2-learn@zoonk.test`    | Quantum physics from scratch, 45 minutes a day, five phases, placement skipped the math basics                                      | A huge plan that reads as structure, lessons still being written, skipped bases                                                                                |
| Pedro   | `v2-stocks@zoonk.test`   | How the stock market works, to invest his first salary, one hour a day at most                                                      | Practical goal, personal context in private content                                                                                                            |
| Sam     | `v2-explain@zoonk.test`  | One question, answered in five short screens and a check                                                                            | The short path, "Want to go further?"                                                                                                                          |
| Guest   | `v2-guest@zoonk.test`    | Came from a public lesson, finished it and typed a goal, not signed up                                                              | Sign-up moment, nothing lost on sign-up, guest limits                                                                                                          |

## Persona command

`pnpm dev:persona <name> [--day <n>] [--away <days>] [--plus|--free] [--tz <zone>] [--locale en|pt]` writes a private copy of a seeded persona to the local development database, with no AI cost, and prints its email, how to sign in and the URL to open. `<name>` is the first name in lowercase: `ana`, `lucas`, `marcos`, `maya`, `pedro` or `sam`.

- `--day <n>`: today is day n of the plan; day 1 is the day the plan was made. The personas' own days are Ana 15, Lucas 19, Marcos 29, Maya 25, Pedro 7 and Sam 1. A later day starts the plan earlier and fills the extra days with the persona's usual history. An earlier day is the morning of day n: later lessons are still to do, later mistakes open, later belts, mocks and calls haven't happened, and the app builds today's session when they open Today. Placement stays on day 1.
- Maya's `--day 3` is short (about 7 of 45 min, no lesson) because her saved week holds her first lesson tomorrow and the plan keeps the shown week (R7).
- `--away <days>`: they skipped the last days, so Today opens with missed-days handling. With `--day`, they last studied on day n minus those days.
- `--plus` or `--free` sets their plan, `--tz` their time zone and `--locale` the language they learn in, when their course is written in it (Marcos's English course is only for Portuguese speakers). Their own words, such as the goal as typed and their memory, stay in their language. Exam dates stay real.
- Copies are `persona-<name>-<key>@zoonk.test`. `pnpm dev:remove-test-learners --yes` removes them along with every other test learner except `onboarded-` ones, other agents' included, so run it when no one else's pass is using the database.

### Copies of an onboarded learner

Walk the onboarding once, then clone with `--from`. Sign up as `onboarded-<name>@zoonk.test` (such as `onboarded-sofia@zoonk.test`), walk the onboarding as that persona until Today shows the first session, and then leave that learner alone: walk copies instead. `pnpm dev:persona --from onboarded-sofia@zoonk.test [--day <n> | --away <days>] [--plus|--free] [--tz <zone>]` copies their goal, plan, Library links, sessions, history and private content into a new `persona-sofia-<key>@zoonk.test`, with no AI cost, so one paid onboarding serves every later pass.

- The copy starts on the day of the source's last change, whenever you make it: day 1 for a learner who only onboarded. `--away <days>` makes them skip that many days first, and `--day <n>` puts them on day n, never before the source's last change.
- Every date moves with the copy, the goal's date included, so the plan stays the one the planner made, and the weekdays they study move by the same days. An exam whose notice gives an official day then sees Today offer that day; take it or dismiss it as the learner would.
- `--plus` or `--free` sets their plan (the source's by default) and `--tz` their time zone, at the same local times. They learn in the source's language.
- `pnpm dev:remove-test-learners` keeps `onboarded-` learners. To walk an onboarding again, sign up with a new `onboarded-` email.

## Personas that start from onboarding

These journeys start by typing a goal, so walk them through the real onboarding on a warm Library, once per persona as `onboarded-<name>@zoonk.test`, then clone with `--from` for every later walk (see [copies of an onboarded learner](#copies-of-an-onboarded-learner)).

| Persona    | Goal                                                                    | Life                                           | Watch for                                                                                                                    |
| ---------- | ----------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sofia      | Brazil's bar exam (OAB, first phase) in three months                    | Plus, two hours on weekdays, laptop            | Mocks exactly like the exam, the ethics subject's weight, "less X, more Y" changes, progress per subject                     |
| Rafaela    | Civil service exam for Brazil's Chamber of Deputies (Cebraspe)          | Free, one hour a day, phone                    | Notice topics on day one, true/false items where a wrong answer cancels a right one, Plus features shown locked, free limits |
| Lucas M.   | ENEM for medicine at UFMG                                               | Three hours a day, phone, strong in some areas | Bases choices, "Study everything", the English or Spanish pick, far rows of a long plan                                      |
| Carla      | Career change into UX design                                            | Plus, 45 minutes, laptop and phone             | A career plan that isn't an exam, portfolio work, a handful of bases                                                         |
| Bia        | Biology class test next week, from her own notes and the teacher's list | Free, 30 minutes after school, phone           | Announced topics first, missed days, the day before the test is a full review                                                |
| Cold start | A goal the Library has never seen (e.g. tuning a guitar by ear)         | Any                                            | Waits, private content written without review, nothing pretending to be ready                                                |

## Lenses to add to any persona

Give one persona per walk at least one of these: a 390 px phone; a screen reader or keyboard only; larger text and reduced motion; a learner whose language isn't Portuguese, when the change has copy or translations; a device in another time zone; a slow network or a slow AI answer; a week away; a mind change halfway through (new date, fewer minutes, another focus).
