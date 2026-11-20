# Oxlint plugin

Do not add test files, test dependencies, or test infrastructure inside this package. A rule is checked by running Oxlint on small valid and invalid examples: `scripts/verify/lint-rules.test.mts` does that for the rules that hold the design system's pieces, and a new rule of that kind adds its examples there.
