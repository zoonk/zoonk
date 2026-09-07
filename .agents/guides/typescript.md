# TypeScript and JavaScript

Use these conventions for TypeScript and JavaScript in apps, packages, and repository scripts.

- Prefer functional composition, early returns, and immutable transformations. Keep array callbacks trivial; extract branching, normalization, or multi-step business logic into named helpers. Split distinct responsibilities into separate files or an internal `_utils/` folder.
- Do not compute values with `let` and reassignment. Use helpers with early returns; use `[condition && value, ...].filter(Boolean)` for conditional arrays.
- Use meaningful names. Functions with multiple domain parameters take one named object parameter; framework callbacks and React `cache` functions may use positional arguments to preserve their contracts and memoization.
- Preserve independent async work in `Promise.all` or `Promise.allSettled`; do not introduce waterfalls. Avoid holding an unawaited promise merely to overlap work when direct `Promise.all` expresses it clearly.
- Use `safeAsync` where an operation needs explicit error handling. Let errors propagate when the owning boundary must handle them; do not turn infrastructure failures into successful empty results.
- Prefer static imports. When moving symbols, update callers to the new file without compatibility re-exports or redundant aliases.
- Use `/** ... */` comments for non-obvious reasons and constraints, not to narrate code or document self-explanatory props. Explain why that code is needed, not what it does.
- Fix Knip reachability and cleanup problems; do not silence them with ignores, entry patterns, or `@public` unless the export is an intentionally supported external API.
