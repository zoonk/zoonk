# Persona passes

How to put a learner at a chosen point of a plan without calling a model, and how to keep the shared Library between passes. The [persona catalog](personas.md) says who each persona is.

- When a walk must skip paid AI, use the [local app's no-spend startup](../../../guides/local-app.md#ai-gateway-and-blob).
- Put a seeded persona on any day of its plan with `pnpm dev:persona <name> [--day <n>] [--away <days>] [--plus|--free] [--tz <zone>] [--locale en|pt] [--state <state>]`. It writes a private copy to the local development database without calling a model and prints how to sign in; the [persona catalog](personas.md) explains the options.
- Walk an onboarding once as `onboarded-<name>@zoonk.test`, then copy that learner for every later pass with `pnpm dev:persona --from onboarded-<name>@zoonk.test [--day <n> | --away <days>] [--plus|--free] [--tz <zone>]`, which writes a private copy the same way.
- Keep the shared Library between passes: once no workflow is running, `pnpm dev:remove-test-learners` lists every learner the seed didn't write except `onboarded-` ones, and `--yes` removes them through account deletion. Shared courses, lessons, skills and exam content stay, so the next pass doesn't pay to generate them again. It only runs against the local development database.
- Reset the database and reseed it only when migrations change the schema; a reset throws away the shared Library.
- To cover the cold path, run one persona per pass on a goal no earlier pass used.
