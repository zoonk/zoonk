# A PR body with pictures

Read this before `gh pr create` or `gh pr edit` sends a body that shows screenshots or videos.

## Check them first

Before `gh pr create` or `gh pr edit` sends a body with pictures, run `pnpm pr:media check <body.md> --root .` from the repository root and send it only once it passes: every picture captured, current and read ([what it holds a picture to](../../zoonk-commit/references/picture-gate.md)). Write each picture as `![description](path)`, with no spaces in the path; an `<img>`, `<video>` or reference-style picture fails, and so does picture syntax shown as an example in code (leave out the `!`). A picture from `pnpm pr:media device` goes in the body only in the section `pnpm pr:media device-section` writes ([the device section](../../zoonk-commit/references/picture-gate.md)). A picture copied away from its capture folder needs `--manifests <that folder>`. `NO PICTURES` means the body links none, so nothing was checked.

## Upload them

Upload the body's screenshots and videos ([show the change](../../zoonk-commit/references/show-the-change.md)) with `gh` 2.99 or newer, from the repository root: link each local file in the body (`tmp/pr-media/media.md` already does), then pass every one with `--attach` (`pnpm pr:capture` prints the flags): `gh pr create --title <title> --body-file <body> --attach <file> --attach <file>`, or `gh pr edit <pr> --body-file <body> --attach <file>` on an open PR. `gh` uploads each to GitHub and puts its URL where the body linked it; a video alone in its paragraph plays inline. When an upload fails, `gh` still creates or updates the PR with the others and exits non-zero, so check that `gh pr view <pr> --json body` has no local path left, and attach what's missing with `gh pr edit`.

A harness tool that opens or edits a PR without taking files can't upload pictures, so when one opened the PR, follow it with `gh pr edit --attach`. `gh` needs the network and the user's GitHub login: in a sandbox that blocks either, ask to run the command outside it. Never open the PR without its pictures or report that they can't be attached.

## After a push

A push to the app or `packages/` makes its after pictures stale: capture them again, read the changed ones, and pass `pnpm pr:media check` before the body is edited.
