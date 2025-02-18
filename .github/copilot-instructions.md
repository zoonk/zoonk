## Ecto

Use the pipe-friendly syntax for better readability and composability. Instead of:

```elixir
Repo.all(from(u in User, where: u.age > 18))
```

Prefer:

```elixir
User
|> where([u], u.age > 18)
|> Repo.all()
```

This keeps queries clean and easier to extend.

Organize queries in a separate module. If you have a `Zoonk.Schema.UserToken` schema, create a `Zoonk.Queries.UserToken` module to manage all related queries. This improves clarity, making business rules more explicit and easier to understand.

Example:

```elixir
defmodule Zoonk.Queries.UserToken do
  import Ecto.Query

  @doc """
  Returns the token struct for the given token value and context.
  """
  def by_token_and_context(token, context) do
    where(UserToken, [t], t.token == ^token and t.context == ^context)
  end
end
```

## Documentation

Keep documentation clear and concise. When writing a `@moduledoc`, include only its content—no need to wrap the entire module.

Avoid vague phrases like “ensures reliability” or “handles securely” and judgmental terms like “essential” or “best practices.” Instead, explain what the module does and how it works. If it follows a security measure or a recommended approach, state that directly rather than making broad claims.

Use `@moduledoc` for a high-level overview of the module’s purpose and when to use it. Avoid listing function details—they belong in their respective `@doc` tags. Only include examples if they demonstrate the module’s primary use case, such as for utility modules or workflows.

For schema modules (e.g., `Zoonk.Schema.User`), briefly describe the schema and its fields. Focus on why the schema exists and what it represents rather than listing attributes.

Leave detailed function usage for `@doc`, where you can include examples and explanations. Only add examples to `@moduledoc` if they clarify overall module usage; otherwise, keep them inside `@doc`.

Keep the first line of a `@moduledoc` or `@doc` brief. For example, _Handles authentication token generation_ is better than _Handles the generation of authentication tokens for different contexts, such as sessions and email-based authentication._

For code examples, don’t use `elixir` at the beginning, as it doesn’t work well with Elixir docs. Use tabs instead.

## i18n

When translating files, make sure the translations are consistent across the application. For example, if you have a translation for "Hello" in one file, ensure it's the same in all other files. Take care to maintain the context of the message to ensure accurate translations in similar scenarios.
