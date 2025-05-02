# Project

- When solving a problem, always try to find the simplest solution. If you find yourself writing complex code, take a step back and think about how you can simplify it. Ask yourself: "Is this the best way to do it?", "Is this the most readable way to do it?", "Is this the simplest way to do it?". Always strive for simplicity and readability.
- When creating a design, ask yourself how companies known to have a great/clean UX (like Apple, Linear, Vercel, shadcn) would do it. Look for inspiration in their designs and try to apply similar principles to your own work. Thinking about Apple's Human Interface Guidelines can also be beneficial.
- Try to avoid using JavaScript as much as possible, always try to see if there's a Phoenix or LiveView solution for it. When it's necessary to use JavaScript, prefer to create a LiveView hook using phx-hook.
- Use `@impl ModuleName` for callback implementations instead of `@impl true`.
- Use the next HEEX syntax `{@variable}` instead of `<%= @variable %>`.
- When you need to conditionally render an item, you don't need to create a separate div or element for it, you can use use `:if` directly in the element. For example, instead of `<% if !@empty do %><.card_content>...</.card_content><% end %>` or `<div :if={!@empty}><.card_content>...</.card_content></div>`, you can use `<.card_content :if={!@empty}>...</.card_content>`.
- When writing text, use Gettext for translations. For example, instead of `Hello`, use `gettext("Hello")` or `dgettext("somedomain", "Hello")` for domain-specific translations.
- When using the zoonk domain, always write `zoonk.com`, not `zoonk.org`. For testing, you can use `zoonk.test` instead.
- Before suggesting any code, check if this code can be simplified even further. Continue doing this until you reach the simplest solution possible.
- Always add tests to any functionality you add or modify.
- Use Verified Routes instead of Router helpers. For example, instead of using `Routes.page_path(@conn, :index)`, use `~p"/"` or `~p"/#{@user}"` for dynamic routes.
- Use the new `Gettext` syntax for importing it: `use Gettext, backend: Zoonk.Gettext` instead of `import ZoonkWeb.Gettext`.
- For lists that can be sort alphabetically, add `# styler:sort` above the list. This will automatically sort the list when you save the file.
- When writing queries, use pipe-based syntax for readability and composability. For example, instead of using `from u in User, where: u.name == ^name`, use `User |> where([u], u.name == ^name)`.
- Elixir now has set-theoretic types. This means the compiler can catch type issues when we use structs. They won't use `@spec` (typespecs) in the future, so you don't need to add them. Instead, focus on writing good structs and using them in functions. For example, `def foo(%MyStruct{} = my_struct)` is better than `def foo(my_struct)`.
- When you finish your changes, run `mix test` to ensure everything is working correctly.
