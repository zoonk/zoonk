# Contributing

## Reporting bugs

Use the [bug report form](https://github.com/zoonk/zoonk/issues/new?template=bug_report.yml). An AI agent can also file it for you in English, even if you tell it what happened in another language.

AI agents filing a report: follow the [bug report guide](.agents/skills/zoonk-bug-report/SKILL.md).

Report security problems privately, as [SECURITY.md](SECURITY.md) describes. For a problem with your account or a payment, use [Help](https://www.zoonk.com/support).

## Suggesting features

Share ideas and feature requests in [Discussions](https://github.com/zoonk/zoonk/discussions/new?category=ideas), not issues, so others can upvote them and add their own needs. An AI agent can also post your idea for you in English, even if you describe it in another language.

AI agents posting an idea: follow the [feature request guide](.agents/skills/zoonk-feature-request/SKILL.md).

## Translations

Zoonk supports the languages in [`SUPPORTED_LOCALES`](packages/utils/src/locale.ts). For commercial reasons, we’re not accepting new translations right now.

## Commit Messages

Add one of the following prefixes to your commit messages:

- `feat:` a new feature
- `fix:` a bug fix
- `chore:` changes to the build process or auxiliary tools and libraries
- `docs:` documentation changes
- `refactor:` code changes that neither fix a bug nor add a feature
- `test:` adding or updating tests
- `deps:` updating dependencies

If applicable, include the app or package name in parentheses after the prefix. For example:

- `feat(auth): add login functionality`
- `fix(ui): resolve button alignment issue`
