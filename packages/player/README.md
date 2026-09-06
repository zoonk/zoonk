# Player

The player separates domain step kinds from UI scenes.

Domain step kinds still matter for validation, scoring, and analytics. The UI
layer maps those kinds into a smaller set of shared scene families so layout
and interaction rules stay consistent as the player grows.

## Scene Model

The player shell thinks in a few broad scenes:

- `read`
- `choice`
- `feedback`
- `completion`

Each scene family has shared primitives that own its layout and baseline
typography. Step-specific components should mainly adapt data into those
primitives instead of redefining the scene themselves.

## Ownership

As a rule:

- shared scene primitives own layout, spacing, and baseline scene typography
- step adapters own domain-specific content and data mapping
- the screen model decides which scene the shell renders

If a new screen needs a variation of an existing shared pattern, prefer adding
a semantic variant to the shared primitive instead of introducing local
one-off styling in the adapter.

## Local Styling

Local styling is still appropriate for content that is genuinely unique to a
feature and not part of the shared scene language.

Examples include:

- vocabulary word display
- grammar highlighting
- metric pills
- evidence drawer rows
- visual-step content

When in doubt, ask whether a style belongs to the shared player language or to
content inside that language. Shared language belongs in the shared primitive.

## Optional Lesson Questions

Questions are available through `@zoonk/player/questions`. Apps that do not offer questions can keep using `@zoonk/player/provider` and `@zoonk/player/shell` without importing the questions module or its stylesheet, and omit `questionSupport` from `PlayerProvider`.

To enable questions:

- Import `useLessonQuestions` and `LessonQuestionPanel` from `@zoonk/player/questions`, and import `@zoonk/player/questions/styles.css` in the app's stylesheet entry point.
- Create a stable `LessonQuestionConnection` containing the API base URL and a `getHeaders` function that retrieves current authentication headers for each request. Pass it to `useLessonQuestions` with the lesson ID, displayed lesson steps, and authentication state.
- Pass the returned `controller.questionSupport` to `PlayerProvider`, and render `LessonQuestionPanel` alongside the player using the same controller and lesson metadata.
- Supply the panel's `navigation` with the app's link component, sign-in and subscription URLs, and `renderLimitAction` for the app's quota action. The panel owns its copy; apps only supply their navigation and subscription integration.

The module owns the question sheet, streaming, conversation recovery, lesson-content copying, and Markdown rendering. Its translations are included in the existing player messages. Authorization, quotas, persistence, and generation remain in Core and the API; passing `isAuthenticated` controls presentation, not permission enforcement.
