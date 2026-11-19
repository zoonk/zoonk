# Using the change in the running app

Step 3 of [verify](../SKILL.md). Run the app and do what the change is for, as a learner would.

- **Web:** verify on `pnpm start`, which serves the production build learners get, sign-in and mailbox included ([running the app locally](../../../guides/local-app.md)). Sign in as a seeded persona or your own copy ([persona passes](../../zoonk-persona-walkthrough/references/passes.md)) with the newest code in the dev mailbox. Drive the browser with whatever you have (Playwright, `agent-browser`, a browser extension or the harness's preview) and keep screenshots of the result. `pnpm pr:capture` takes the PR's before and after ([capturing screens](../../zoonk-commit/references/capture.md)).
- **API:** call the endpoint as a learner, with a persona's bearer token, and read the response against the OpenAPI contract.
- **Native:** `pnpm iphone`, `pnpm ipad`, `pnpm android:phone` or `pnpm android:tablet`; tap through the screens. [Measuring the Apple app](apple.md) and [the Android app](android.md) count requests per screen and tab switch, memory, leaks, idle CPU and hangs or jank.
- **AI:** nothing calls a model until a learner clicks. Prefer fixtures and seeded personas; when the change depends on what a model writes, walk one real run, keep it small, and say what it cost.

## Server errors

`pnpm start` prints the server's errors in its output, and `verify:pages` reports the browser's. Production shows the browser only a digest or a minified React error, so reproduce one on `pnpm dev` for the full message. With the page open in a browser, the dev server reports what went wrong on both sides through its MCP endpoint (`get_errors`); [next-dev-loop](../../next-dev-loop/SKILL.md) has the call and its other tools (routes, compile issues, logs).
