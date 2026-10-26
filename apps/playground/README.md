# Zoonk Playground

A local tool for developers with two halves:

- **The design system** (`/design`): what every color token, type role, shape, icon, pattern and special moment means and where it goes, beside live specimens and every token's value in light, dark and both more-contrast modes, read from `packages/ui/src/styles/globals.css` as the browser loaded it. Its words live in `src/design-system/`, a typed module agents read too; values never live there.
- **The player** (`/`): a local preview of everything the lesson player shows: every activity template (explored on an explanation screen, answering and checked), every lesson screen kind, pictures and language exercises, on a phone or a desktop. Screens follow your computer's light or dark appearance, as the player follows a learner's device. Each screen plays in the real player with the server stood in for, from `@zoonk/player/preview`, the same fixtures the player's browser tests use. Nothing is saved, and the app is never deployed.

## Running the app

`pnpm dev` from the repository root starts it with the other apps, at the playground's Portless address (`http://playground.<project>.localhost:1355`). To run it alone:

```bash
pnpm --filter playground dev:direct
```

Then open `http://localhost:3202`.

## Changing the design system

Change a value in `globals.css` and the pages show it in every mode. Change what something means or where it goes in `src/design-system/` (and the `zoonk-design` skill if a rule changes). A new token needs its row in `src/design-system/color.ts`.

## Adding a screen

Screens come from the player's catalog (`packages/player/src/preview/preview-catalog.ts`). A new activity template shows up on its own once it has a fixture in `@zoonk/testing/fixtures/activity-contents`; add other screens to the catalog there.
