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
