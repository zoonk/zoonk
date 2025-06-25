# Zoonk Agent Principles

## General Principles

- Prioritize the **simplest solution**. If code feels complex, step back. Ask: “Is this the simplest, clearest way?” Repeat until simplicity is achieved.
- For design decisions, follow principles used by companies like **Apple, Linear, Vercel**. Prioritize clean, intuitive UX.
- Default to **Phoenix/LiveView solutions**. Only use JavaScript when unavoidable, and implement it via `phx-hook`.
- Replace `@impl true` with **`@impl ModuleName`**.
- Use the **new HEEX syntax** `{@variable}` instead of `<%= @variable %>`.
- Prefer `:if` in elements instead of wrapping them in `if` blocks. E.g., `<ul :if={@items}>` instead of `<%= if @items do %>`.
- Use **Gettext** for all text. Never hardcode strings.
- Use **Verified Routes** (`~p"/path"`) instead of `Routes.page_path/2`.
- Before suggesting code, aggressively simplify it using pattern matching, guards, and helper functions.
- Make functions short and avoid nested blocks. If a function is long, break it into smaller functions.
- Always write tests for any added or changed functionality.
- Use **pipe-based query syntax** for clarity and composability.
- Use **Elixir’s set-theoretic types** through structs. You don't need to add `@spec`.
- Name unused variables (e.g., `_error`), don’t leave as `_`.
- Favor **pattern matching** over `case` or `cond`.

## File and Code Structure

### Configuration

- Store global configs in `lib/zoonk/config/`.
- Prefix modules with `Zoonk.Config.*` (e.g., `Zoonk.Config.LanguageConfig`).

### Schemas

- Use context-prefixed names (e.g., `Zoonk.Accounts.User`).
- Add a `@moduledoc` with a **field table** for schemas: Field Name | Type | Description.
- Use `List` instead of `Array` for types.
- Always include `timestamps(type: :utc_datetime_usec)`.
- Default `array` fields to `[]`.
- Generate migrations alongside schema changes using `mix ecto.gen.migration`.

### Controllers

- Located in `lib/zoonk_web/controllers/`.
- Use `use ZoonkWeb, :controller`.
- Add `@moduledoc` for the controller and `@doc` for each action.
- File and module names should match.

### LiveView Pages

- Located in `lib/zoonk_web/live/`.
- Use `@moduledoc false`.
- Place `render` callback **at the top** of the module.
- Use `use ZoonkWeb, :live_view`.

### Components

- Shared components: `lib/zoonk_web/components/`.
- Import them via `html_helpers` in `zoonk_web.ex`.
- Use `Phoenix.Component.attr/3` for attributes.
- Write `@moduledoc` and `@doc` with usage examples.
- Add previews in `lib/zoonk_dev/ui_preview/` and register routes for them.
- Use `<.text>` for any textual content, never raw tags.
- Render slots with `{render_slot(@inner_block)}` only.
- When styling, pass classes to the component (`<.card_content class="...">`), not through extra divs.

### CSS

- Use **Tailwind CSS v4**.
- Never use default Tailwind colors. Use tokens like `bg-zk-surface`.
- Create reusable utilities in `app.css` with `zk-` prefix.
- Use `size-` for equal width/height (`size-4` instead of `w-4 h-4`).

### Icons

- Use **Tabler icons** via `<.icon name="tabler-icon-name" />`.

### API

- Use `ZoonkWeb.API.ErrorResponse` for error formatting.
- Add missing error formats if needed.

## Documentation Standards

- Clear, concise, objective.
- Avoid vague terms (“secure,” “best practice”); describe exact behavior.
- Use `@moduledoc` for module overviews and `@doc` for functions.
- Always include usage examples in `@doc`.
- Don’t prefix examples with `elixir`.
- Group multiple `on_mount` docs into a **single `@doc` block**.

## Testing

- Mirror controller/module names with `_test` suffix.
- Use `ZoonkWeb.ConnCase` for web, `Zoonk.DataCase` for data.
- Create fixtures in `test/support/fixtures/`.
- Avoid setup blocks for fixtures; call them explicitly.
- Use the **PhoenixTest** library for testing.
- Use `Phoenix.Flash.get/2` instead of deprecated `get_flash/2`.
- Never expose private functions for testing.
- Never run tests using VSCode's debugging tools because they don't work properly and crash the test suite. Instead, use `mix test`.

## Translations

- Keep translations consistent across contexts.
- Don't update translation files manually. Instead use `mix locale` to update them.

<!-- usage-rules-start -->
<!-- elixir-start -->

## elixir usage

# Elixir Core Usage Rules

## Pattern Matching

- Use pattern matching over conditional logic when possible
- Prefer to match on function heads instead of using `if`/`else` or `case` in function bodies

## Error Handling

- Use `{:ok, result}` and `{:error, reason}` tuples for operations that can fail
- Avoid raising exceptions for control flow
- Use `with` for chaining operations that return `{:ok, _}` or `{:error, _}`

## Common Mistakes to Avoid

- Don't use `Enum` functions on large collections when `Stream` is more appropriate
- Avoid nested `case` statements - refactor to a single `case`, `with` or separate functions
- Don't use `String.to_atom/1` on user input (memory leak risk)
- Lists and enumerables cannot be indexed with brackets. Use pattern matching or `Enum` functions.

## Function Design

- Use guard clauses: `when is_binary(name) and byte_size(name) > 0`
- Prefer multiple function clauses over complex conditional logic
- Name functions descriptively: `calculate_total_price/2` not `calc/2`

## Data Structures

- Use structs over maps when the shape is known: `defstruct [:name, :age]`
- Prefer keyword lists for options: `[timeout: 5000, retries: 3]`
- Use maps for dynamic key-value data
- Prefer to prepend to lists `[new | list]` not `list ++ [new]`

<!-- elixir-end -->
<!-- otp-start -->

## otp usage

# OTP Usage Rules

## GenServer Best Practices

- Keep state simple and serializable
- Handle all expected messages explicitly
- Use `handle_continue/2` for post-init work
- Implement proper cleanup in `terminate/2` when necessary

## Process Communication

- Use `GenServer.call/3` for synchronous requests expecting replies
- Use `GenServer.cast/2` for fire-and-forget messages.
- When in doubt, us `call` over `cast`, to ensure back-pressure
- Set appropriate timeouts for `call/3` operations

## Fault Tolerance

- Set up processes such that they can handle crashing and being restarted by supervisors
- Use `:max_restarts` and `:max_seconds` to prevent restart loops

## Task and Async

- Use `Task.Supervisor` for better fault tolerance
- Handle task failures with `Task.yield/2` or `Task.shutdown/2`
- Set appropriate task timeouts
- Use `Task.async_stream/3` for concurrent enumeration with back-pressure

<!-- otp-end -->
<!-- igniter-start -->

## igniter usage

[igniter usage rules](deps/igniter/usage-rules.md)

<!-- igniter-end -->
<!-- usage-rules-end -->
