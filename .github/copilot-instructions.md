## Miscellaneous

- Use `@impl ModuleName` for callback implementations instead of `@impl true`.

## Documentation

- Keep documentation clear and concise.
- Avoid vague phrases like “ensures reliability” or “handles securely” and judgmental terms like “essential” or “best practices.” Instead, explain what the module does and how it works. If it follows a security measure or a recommended approach, state that directly rather than making broad claims.
- In `@moduledoc`, avoid listing all functions. Instead, use `@doc` for function-specific documentation.
- Add examples to `@doc` for each function, especially if the function is complex or has multiple parameters. Use `@doc` to explain the purpose of each function and its parameters.
- Keep the first line of a `@moduledoc` or `@doc` brief. For example, _Handles token generation for authentication_ is better than _Handles the generation of authentication tokens for different contexts, such as sessions and email-based authentication._
- For code examples, don’t use `elixir` at the beginning, as it doesn’t work well with Elixir docs. Use tabs/spaces instead.
- When creating a new guide, add it to the `extras` section in the `mix.exs` file.

## CSS

- Use `tailwind` for CSS.
- Never use tailwind colors directly. Instead, use the colors defined in `assets/css/main.css`.
- Common used utilities should be added to the `assets/css/main.css` file and have a `zk` prefix. For example: `@utility zk-surface {@apply p-4}`.
- When adding tailwind utilities, ensure they're consistent with the existing ones in `assets/css/main.css`.

## Translations

- Keep translations consistent across the application. If you have a translation for "Hello" in one file, ensure it's the same in all other files. Take care to maintain the context of the message to ensure accurate translations in similar scenarios.

## Configuration

- Add constants and general configuration options in the `lib/zoonk/configuration.ex` file.
- When adding a new function to `Zoonk.Configuration`, add a `@doc group` to the function (e.g., `@doc group: "Authentication"`).

## Schemas

- Use the schema context as the module prefix (e.g., `Zoonk.Accounts.User`).
- Add a `@moduledoc` to each schema, explaining its purpose and the fields it contains. Use a table to clearly display the fields and their descriptions. Include three columns: Field Name, Type, and Description.
- Add `timestamps(type: :utc_datetime)` to all schemas.
- When writing or updating a schema, also create a migration file for it. Use `mix ecto.gen.migration` to generate the migration file or store it at `priv/repo/migrations/` with a timestamp prefix.
- When using a schema module, use `alias Zoonk.Accounts.User` to avoid long module names.

## Components

- Shared components should be placed in the `lib/zoonk_web/components` directory.
- Use a shared component whenever available. If a component is not available, create it. Make changes to existing components if necessary to accommodate new use cases.
- When creating a new shared component, add it to the `html_helpers` function of the `lib/zoonk_web.ex` file.
- Add a `@moduledoc` to each module and a `@doc` to each function/component, including examples of how to use the component.
- Group related components together. For example, the `flash.ex` contains both `flash` and `flash_group` components.
- Add `Phoenix.Component.attr/3` to each component to define the attributes it accepts. Include the `doc` option to provide documentation for each attribute.
- Components modules are prefixed with `ZoonkWeb.Components` (e.g., `ZoonkWeb.Components.Flash`).
- Turn repetitive code into components. However, for code specific to a section (e.g. authentication), keep it in the section's directory instead of `lib/zoonk_web/components`. For example, `lib/zoonk_web/live/users/user_components.ex` contains components specific to the user section.
- When you want to style a component like `<.card_content>`, add a class to it (i.e. `<.card_content class="flex flex-col gap-4">`) instead of creating a div inside the component just for styling.
- When creating a component, also create a preview for it in the `lib/zoonk_dev/ui_preview` directory following the same pattern from other components placed there. For example, when creating/updating `lib/zoonk_web/components/anchor.ex`, also create/update `lib/zoonk_dev/ui_preview/anchor_preview.ex`.
- When adding a component to the `lib/zoonk_dev/ui_preview` directory, also create a router for it in the `/ui` scope along with the other component routes - and update the `lib/zoonk_dev/ui_preview_layout.ex` file to include the new component in the menu list, alphabetically ordered.
- When updating a component, also update its preview in the `lib/zoonk_dev/ui_preview` directory.
- When conditionally adding a class to a component, convert it to a list and use the `@variant == :primary && ""` pattern. For example, `class={[@variant == :primary && "bg-zk-primary"]}`.

## Icons

- Use tabler icons.
- Use the <.icon /> component for icons. For example, `<.icon name="tabler-home" />`.

## Controllers

- Controllers should be placed in the `lib/zoonk_web/controllers` directory.
- Add a `@moduledoc` to each controller.
- Add a `@doc` to each action in the controller, explaining its purpose.
- Controller modules are prefixed with their context name (e.g., `ZoonkWeb.Accounts.OAuthController`).
- Use the module name as the file name (e.g., `lib/zoonk_web/controllers/accounts/oauth_controller.ex`).
- Use `use ZoonkWeb, :controller` in each controller module.
- Add tests to the `test/zoonk_web/controllers` directory.

## LiveView pages

- LiveView pages should be placed in the `lib/zoonk_web/live` directory.
- Group similar pages together. For example, the `lib/zoonk_web/live/user` directory contains all user-related pages.
- Use `@moduledoc false` for LiveView pages.
- Keep the html and business logic in the `.ex` file, using the `render` callback from `Phoenix.LiveView`.
- Add the `render` callback at the top of the module, before other callbacks like `mount`, `handle_params`, etc.
- Use `use ZoonkWeb, :live_view`.
- Add tests to the `test/zoonk_web/live` directory.

## Tests

- Always add tests to any functionality you add or modify.
- Use the same name as the controller, but with `_test` suffix (e.g., `test/zoonk_web/controllers/accounts/user_session_controller_test.exs`) and the module name would be `ZoonkWeb.Accounts.UserSessionControllerTest`.
- Use `use ZoonkWeb.ConnCase, async: true` for `ZoonkWeb` tests and `use Zoonk.DataCase, async: true` for `Zoonk` tests.
