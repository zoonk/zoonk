- Keep commit messages under 50 characters.
- Always start with a prefix that matches the area being changed:
  - Use the module, context, or schema name for changes in `lib/zoonk/`. For example:
    - Accounts: for changes in `lib/zoonk/accounts/`
    - Users: for changes to the `Zoonk.Accounts.User` schema
  - For LiveView or frontend changes in `lib/zoonk_web/live/`, use the feature folder name as the prefix. For example:
    - Catalog: for changes in `lib/zoonk_web/live/catalog/`
    - Library: for changes in `lib/zoonk_web/live/library/`
  - For API changes use `API: {Context}:` as the prefix. For example: `API: Accounts:`.
  - For asset changes in `assets/`, use Assets.
  - For changes in the `guides` folder, use Docs.
  - When adding a component, use `Components: Add {component_name}`. Don't do `Components: Add {component_name} component` or `Components: Add {component_name} and preview`. It's implicit that it's a component and we're adding a preview.
  - When updating a component, use `{ComponentName}` as the prefix.
  - For CI-related changes in `.github/workflows/`, use `CI:` but for changes in `.github/copilot/`, use `Copilot:`.
  - When we make changes to tests only, use the prefix `Tests:`.
  - When the commit only adds a function, use the function arity. For example: `Orgs: Add get_org_settings/1` is better than `Orgs: Add get_org_settings function`.
- In general:
  - Match the prefix to the area or feature being modified.
  - Use meaningful and specific names over generic ones.

## Good commit messages examples

- Accounts: Add user authentication
- Users: Fix user registration validation
- Catalog: Update product details page
- Library: Improve library search functionality
- Assets: Add dialog trigger hook
- CI: Add tests

## Bad commit messages examples

Commits that are too generic or vague:

- Accounts: Fix
- Users: Update

Commits that use the wrong prefix:

- Catalog: Fix user registration validation
- Library: Add user authentication

Commits that use unnecessary words:

- Assets: Add dialog trigger hook to the project
- CI: Add tests to the project
- Accounts: Fix user registration validation in the project

In all those above the "to the project" part is unnecessary.

Commits that are too long:

- Refactor configuration management by creating separate CurrencyConfig module, updating references, and removing deprecated code.
- Refactor language configuration handling by creating LanguageConfig module and updating references throughout the application
- Enhance org profile tests for case-insensitive matching of custom domains and subdomains
- Fix connection info in LiveView socket configuration for proper URI handling

All those could be shortened to:

- Config: Add CurrencyConfig module
- Config: Add LanguageConfig module
- Tests: Validate subdomain case-insensitivity
- LiveView: Fix socket URI handling
