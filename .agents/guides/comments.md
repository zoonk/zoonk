# Comments

Code says what it does; a comment earns its place only by saying what the code can't. Every comment is one more thing to keep true, and agents add them to match the code around them, so the bar is high and the default is none. This applies to every language in the repository.

- Keep a comment only for:
  - behavior forced by something we can't change (a library, framework, platform, browser, vendor API, protocol, or law), with the issue or doc link when one exists;
  - a product rule the code can't express, where the code would look wrong, or get "fixed", without it;
  - a contract an exported API's callers rely on that its name and types don't give, such as what it throws, authorizes, or guarantees;
  - tool directives: license headers, lint suppressions with `-- reason`, `@ts-expect-error` with a reason, `@public`, formatter ignores, and translator comments.
- Delete everything else: what the next lines do, a name or type restated in words, doc comments on every function, constant, prop, or field, section banners and `// MARK:`, history ("now", "previously", "no longer"), commented-out code, and test steps the test's name already says.
- When our own code needs a comment to be understood, change the code instead: rename, extract a named function or constant, use a type, or simplify. A comment justifying a workaround in our own code is a sign to fix the workaround.
- A kept comment is one or two short sentences about why, not what.
