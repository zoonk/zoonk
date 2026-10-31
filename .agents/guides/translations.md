# Translations

These rules apply to every app's user-facing copy. Each platform's own steps are in the [web guide](web.md), the [Apple app](../../apps/apple/AGENTS.md) and the [Android app](../../apps/android/AGENTS.md).

- Translations come from Eloqnt: after changing English copy, run `pnpm --filter <app> i18n`, which first fills missing translations with existing translations of the same English from any catalog, then its `i18n:lint`.
- When a translation is wrong or inconsistent, fix it through Eloqnt first: a clearer English source, a translator comment, or a style-guide entry for a recurring term or expression. Then re-translate just that string (`--id <message id>`; on Apple, mark it `needs_review` and run `i18n`).
- Edit a translation by hand only when that re-run still gets it wrong.
- Eloqnt sends the shared [style guide](../../packages/i18n/.eloqnt/styleguide.md) and the target locale's `styleguide.<locale>.md` with every request and supplies translation best practices itself, so add only recurring cross-app terms and expressions (`goal → meta`, “Brain Power”, the verb for “say” in pronunciation practice), Zoonk's voice, and locale conventions a translator couldn't guess; never individual strings, ordinary UI words like “Save”, generic i18n rules, or grammar a good translator applies anyway. Rules for writing English copy go in `styleguide.en.md`, which translations never receive.
