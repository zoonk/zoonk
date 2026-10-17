# Zoonk Playground

A local preview of everything the lesson player shows, for developers: every activity template (explored on an explanation screen, answering and checked), every lesson screen kind, pictures and language exercises, on a phone or a desktop. Screens follow your computer's light or dark appearance, as the player follows a learner's device. Each screen plays in the real player with the server stood in for, from `@zoonk/player/preview`, the same fixtures the player's browser tests use. Nothing is saved, and the app is never deployed.

## Running the app

`pnpm dev` from the repository root starts it with the other apps, at the playground's Portless address (`http://playground.<project>.localhost:1355`). To run it alone:

```bash
pnpm --filter playground dev:direct
```

Then open `http://localhost:3202`.

## Adding a screen

Screens come from the player's catalog (`packages/player/src/preview/preview-catalog.ts`). A new activity template shows up on its own once it has a fixture in `@zoonk/testing/fixtures/activity-contents`; add other screens to the catalog there.
