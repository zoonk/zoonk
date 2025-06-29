# Zoonk Usage Guide for AI Agents

This guide defines the development and design standards used in Zoonk. It ensures consistency, clarity, and simplicity across all parts of the codebase. Follow these instructions strictly when building or updating any part of the app.

---

## Table of Contents

- [About this app](#about-this-app)
- [Principles](#principles)
- [Project Structure](#project-structure)
  - [Configuration](#configuration)
  - [Schemas](#schemas)
  - [Controllers](#controllers)
  - [LiveView Pages](#liveview-pages)
  - [Components](#components)
- [UI and Design Rules](#ui-and-design-rules)
  - [CSS and Tailwind](#css-and-tailwind)
  - [Icons](#icons)
  - [Accessibility and Responsiveness](#accessibility-and-responsiveness)
- [Routing and Text](#routing-and-text)
- [API Standards](#api-standards)
- [Documentation Standards](#documentation-standards)
- [Testing Guidelines](#testing-guidelines)
- [Elixir Usage](#elixir-usage)
- [OTP Usage](#otp-usage)
- [Setup and References](#setup-and-references)

---

## About this app

Zoonk is a learning app that uses AI to create courses with short, interactive exercises that show how things work in real life.

---

## Principles

- Always prefer the **simplest solution**. If something feels complex, refactor.
- Favor **clarity and minimalism** in both code and UI.
- Default to **Phoenix/LiveView** solutions. Use JavaScript only via `phx-hook` and only when unavoidable.
- Follow design inspirations from **Apple, Linear, Vercel**.
- Code must be **modular**, **tested**, and follow **SOLID** and **DRY** principles.
- Favor **pattern matching**, **guards**, and **short functions**. Avoid nesting.
- Prefer `:if` on elements instead of conditional blocks. E.g., <ul :if={@items}> instead of <%= if @items do %>
- Use `@impl ModuleName`, not `@impl true`.

---

## Project Structure

### Configuration

- Store in `lib/zoonk/config/`
- Module naming: `Zoonk.Config.*` (e.g. `Zoonk.Config.LanguageConfig`)

### Schemas

- Use context-prefixed names: `Zoonk.Accounts.User`
- Include `@moduledoc` with a field table:
  ```
  Field Name | Type | Description
  ```
- Use `List`, not `Array` when defining a type in docs
- Default `array` fields to `[]`
- Add `timestamps(type: :utc_datetime_usec)`
- Generate migrations along with schema changes using `mix ecto.gen.migration`

### Controllers

- Located in `lib/zoonk_web/controllers/`
- Use `use ZoonkWeb, :controller`
- Match file/module names
- Add `@moduledoc` and `@doc` for each action

### LiveView Pages

- Located in `lib/zoonk_web/live/`
- Add `@moduledoc false`
- Place `render` at the top
- Use `use ZoonkWeb, :live_view`

### Components

- Shared components go in `lib/zoonk_web/components/`
- Import via `html_helpers` in `zoonk_web.ex`
- Use `Phoenix.Component.attr/3`
- Add `@moduledoc` and `@doc` with usage examples
- Add previews in `lib/zoonk_dev/ui_preview/` and register routes
- Use `<.text>` for all textual content
- Render slots via `{render_slot(@inner_block)}`
- Pass styling through `class=` props, not wrappers

---

## UI and Design Rules

### CSS and Tailwind

- Use **Tailwind v4**
- Avoid default colors — use tokens like `bg-zk-surface`
- Use `zk-` prefix for custom utilities
- Use `size-4` instead of `w-4 h-4`
- Only create custom utilities when we're often using the same styles

### Icons

- Use Tabler icons: `<.icon name="tabler-icon-name" />`

### Accessibility and Responsiveness

- Responsive on mobile, tablet, desktop
- Follow accessibility best practices
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Extend `globals.css`, don’t create new CSS files
- Keep animations minimal and non-distracting
- Prefer CSS/Tailwind for animations over JavaScript

---

## Routing and Text

- Use **Verified Routes** (`~p"/path"`) not `Routes.page_path/2`
- Use **Gettext** for all strings
  - Do not hardcode text
  - Do not generate new translation files
  - Do not run `mix gettext.extract` (this will be done later)

---

## API Standards

- Use `ZoonkWeb.API.ErrorResponse` for error formatting
- Extend it to add missing error types

---

## Documentation Standards

- Be clear, concise, objective
- Avoid vague terms like “secure” or “best practice”
- Use `@moduledoc` for modules
- Use `@doc` for functions, with examples
- Don’t prefix examples with `elixir`
- Combine multiple `on_mount` docs into one `@doc`

---

## Testing Guidelines

- Test file: same name as module + `_test`
- Use:
  - `Zoonk.DataCase` for data
  - `ZoonkWeb.ConnCase` for web
- Fixtures in `test/support/fixtures/`
- Avoid `setup` for fixtures; call fixtures directly on each test
- Use `PhoenixTest` library
- Use `Phoenix.Flash.get/2` (not `get_flash/2`)
- Don’t expose private functions for testing
- Run tests with `mix test`, not VSCode debugger

---

## Elixir Usage

### Pattern Matching

- Use function heads and guards over `if`, `case`, `cond`
- Lists and enumerables cannot be indexed with brackets. Use pattern matching or Enum functions

### Error Handling

- Use `{:ok, result}` and `{:error, reason}`
- Avoid raising for flow control
- Use `with` for chaining

### Data and Function Design

- Prefer `Stream` over `Enum` on large collections
- Don’t use `String.to_atom/1` on user input
- Prefer pattern matching, not indexing lists
- Name unused variables as `_name`, not `_`
- Use structs over maps for known shapes
- Prefer keyword lists for options
- Use descriptive function names
- Use `Oban` for background jobs
- Use **pipe-based query syntax** for clarity and composability.
- Don't need to write `@spec` for functions but use structs in function signatures.

---

## OTP Usage

### GenServer

- Keep state serializable
- Use `handle_continue/2` after init
- Cleanup in `terminate/2`
- Use `GenServer.call/3` with backpressure
- Use `GenServer.cast/2` for fire-and-forget

### Fault Tolerance

- Use supervisors with limits: `:max_restarts`, `:max_seconds`

### Tasks

- Use `Task.Supervisor`
- Use `Task.yield/2` or `Task.shutdown/2` for failures
- Use `Task.async_stream/3` with timeouts and backpressure

---

## Setup and References

- [Installation Guide](guides/installation.md)
- [Glossary](guides/glossary.md)
- [Directory Overview](guides/overview.md)
