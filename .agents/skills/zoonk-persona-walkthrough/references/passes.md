# Persona passes

How to put a learner at a chosen point of a plan without calling a model, and how to keep the shared Library between passes. The [persona catalog](personas.md) says who each persona is.

- When a walk must skip paid AI, use the [local app's no-spend startup](../../../guides/local-app.md#ai-gateway-and-blob).
- Keep the shared Library between passes: once no workflow is running, `pnpm dev:remove-test-learners` lists every learner the seed didn't write except `onboarded-` ones, and `--yes` removes them through account deletion. Shared courses, lessons, skills and exam content stay, so the next pass doesn't pay to generate them again. It only runs against the local development database.
- Reset the database and reseed it only when migrations change the schema; a reset throws away the shared Library.
- To cover the cold path, run one persona per pass on a goal no earlier pass used.

## Persona command

`pnpm dev:persona <name> [--day <n>] [--away <days>] [--plus|--free] [--tz <zone>] [--locale en|pt] [--state <state>]` writes a private copy of a seeded persona to the local development database, with no AI cost, and prints its email, how to sign in and the URL to open. `<name>` is the first name in lowercase: `ana`, `lucas`, `marcos`, `maya`, `pedro` or `sam`.

- `--day <n>`: today is day n of the plan; day 1 is the day the plan was made. The personas' own days are Ana 15, Lucas 19, Marcos 29, Maya 25, Pedro 7 and Sam 1. A later day starts the plan earlier and fills the extra days with the persona's usual history. An earlier day is the morning of day n: later lessons are still to do, later mistakes open, later belts, mocks and calls haven't happened, and the app builds today's session when they open Today. Placement stays on day 1.
- Maya's `--day 3` is short (about 7 of 45 min, no lesson): her seed dates her first lesson on day 4, and the plan keeps a week the learner has already seen (rule R7 in `packages/core/src/plans/_test-utils/rules/RULES.md`). It's a seed-date artifact, not what a new learner gets; pick another day to walk a full one.
- `--away <days>`: they skipped the last days, so Today opens with missed-days handling. With `--day`, they last studied on day n minus those days.
- `--plus` or `--free` sets their plan, `--tz` their time zone and `--locale` the language they learn in, when their course is written in it (Marcos's English course is only for Portuguese speakers). Their own words, such as the goal as typed and their memory, stay in their language. Exam dates stay real.
- `--state <state>` writes a state no day reaches by itself: `placement` brings back onboarding's level check (`/start`, then the plan's reveal), `reveal` only the reveal, and `lessons-used-up` or `maps-used-up` a free learner's spent allowance. The seed's questions cover everything placement asks Pedro (the level check and `/placement-test`), Ana (`/focus-test`) and Marcos (`/level-test`), match and order questions included, so these tests open and run with no AI.
- Copies are `persona-<name>-<key>@zoonk.test`. `pnpm dev:remove-test-learners --yes` removes them along with every other test learner except `onboarded-` ones, other agents' included, so run it when no one else's pass is using the database.

### Copies of an onboarded learner

Walk the onboarding once, then clone with `--from`. Sign up as `onboarded-<name>@zoonk.test` (such as `onboarded-sofia@zoonk.test`), walk the onboarding as that persona until Today shows the first session, and then leave that learner alone: walk copies instead. `pnpm dev:persona --from onboarded-sofia@zoonk.test [--day <n> | --away <days>] [--plus|--free] [--tz <zone>]` copies their goal, plan, Library links, sessions, history and private content into a new `persona-sofia-<key>@zoonk.test`, with no AI cost, so one paid onboarding serves every later pass.

- The copy starts on the day of the source's last change, whenever you make it: day 1 for a learner who only onboarded. `--away <days>` makes them skip that many days first, and `--day <n>` puts them on day n, never before the source's last change.
- Every date moves with the copy, the goal's date included, so the plan stays the one the planner made, and the weekdays they study move by the same days. An exam whose notice gives an official day then sees Today offer that day; take it or dismiss it as the learner would.
- `--plus` or `--free` sets their plan (the source's by default) and `--tz` their time zone, at the same local times. They learn in the source's language.
- `pnpm dev:remove-test-learners` keeps `onboarded-` learners. To walk an onboarding again, sign up with a new `onboarded-` email.
