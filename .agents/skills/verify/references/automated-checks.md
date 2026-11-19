# Automated checks and the diff audit

Step 2 of [verify](../SKILL.md): the change's checks, the owner of each shared rule, and the diff audit.

## Run the change's checks

Format and lint the touched files (lint after format), typecheck their packages and run the affected tests, with the containing suites when the reach is broad: [checks for a change](../../../guides/checks.md) has the table. Before a PR, run them for the whole branch on the final tree.

## Find the owner of a shared rule

Before introducing or changing a constant, predicate, formula, schema, helper, component or class constant, find where the product already does the same thing: a new name or an inline expression can hide an existing rule.

- **Search** the repository with `rg` for the identifier and for equivalent behavior: literal values with their units, kind lists, arithmetic, validation bounds and the fields a predicate checks. For a piece of UI, search its words, icon and classes ([find the piece](../../zoonk-design/SKILL.md#find-the-piece-before-you-build-one)). Follow imports and callers beyond the changed files.
- **Compare** every relevant definition and its consumers, near copies that drifted included. Decide whether they are one product rule or different domains on purpose; matching numbers alone don't show shared meaning.
- **Keep one owner.** A shared rule lives in its owning feature module (`@zoonk/core` for reusable business behavior), with direct leaf imports. When importing the owner would create a cycle, pass its value into the lower-level dependency. Move every relevant consumer onto it in the same change, and remove superseded definitions, aliases, types and tests.
- **Search again** afterwards for the old names, values and equivalent expressions. A focused test of the new helper alone doesn't verify its integrations.

## Answer the diff audit

Run `pnpm verify:diff` (`--base <ref>` for a branch; for copy, run the app's `i18n` first). It lists what a principal engineer, a security researcher and a designer would question in the change, each with its question. It also lists the copies it suspects (a definition, a block, a class list or a sentence that reads like one elsewhere) and the new strings that run long, hedge, or use a word learners never see.

- Answer every item in your report, by fixing the code or saying why it's right.
- Its duplication and copy items are leads, never proof and never blocking. It can't find a rule restated in other words or a piece drawn from other classes: the search above does.
- Credentials, env files, focused tests and a vulnerable dependency the change adds block.
- `pnpm verify:catalog` fails a paying word other than "Subscribe", a plan's name outside pricing and the subscription page, and a "none" option beside Skip in the web's catalogs, and lists Apple's and Android's ([checks on the source](pages.md#checks-on-the-source)).

## What the audit's leads are

Read this only to interpret a lead.

- **Repeated definition:** a module-level `ALL_CAPS` constant or lowercase function the diff adds or edits, in TypeScript source under `apps/*/src` and `packages/*/src`, whose namesakes read alike. Framework exports such as `GET` and `generateMetadata` are left out.
- **Near-duplicate code:** a block of about six lines the diff adds that also appears elsewhere, another added file included, ignoring whitespace, comments and imports.
- **Restated class constant:** an added class list holding every class of an exported `*_CLASS` constant.
- **Same words elsewhere:** an added sentence of five or more words that the web catalogs list for another feature.
- **Copy:** it reads the English catalogs (the web's `messages/en.po`, Apple's String Catalogs, Android's `values/strings*.xml`) and lists each new or reworded string that runs past 20 words, is a button label over three words (web only, where its source sits inside a `<…Button>`), hedges ("for now", "so far", "may", "up to"), uses a term the English style guide's "Plain words first" table never shows learners, or comes with a translator note that defines a word. Strings used only on marketing pages skip the two length leads. The lengths are targets for a designer to weigh, not limits.
