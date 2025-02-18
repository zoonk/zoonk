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

Always strive for clarity and conciseness in documentation. When writing a `@moduledoc`, return only its content—no need to include the entire module.

For code examples, avoid using `elixir`, as it doesn’t work well with Elixir docs. Use tabs instead.

Keep the first line of a `@moduledoc` or `@doc` short. For example, _Handles authentication token generation_ is better than _Handles the generation of authentication tokens for different contexts, such as sessions and email-based authentication._

When writing a `@doc` for a function, include usage examples when helpful, but they’re not needed in a `@moduledoc`.

For a `@moduledoc`, avoid listing features or functions. Instead, focus on the module’s purpose and its role in the application. For example, this is a bad `@moduledoc`:

```elixir
@moduledoc """
Provides composable queries for `Zoonk.Schema.UserToken`.

This module contains functions to query and manipulate user tokens, such as:
  - Retrieving tokens by value and context
  - Fetching tokens for a specific user and context
  - Deleting tokens
  - Verifying session tokens
  - Verifying magic link tokens
  - Verifying email change tokens
"""
```

Instead, write a `@moduledoc` like this:

```elixir
@moduledoc """
Provides query composition for `Zoonk.Schema.UserToken`.

This module defines query builders for retrieving,
verifying, and managing user tokens. It ensures that
token-based authentication mechanisms, such as session
validation, magic link authentication, and email change
requests, are securely and efficiently handled through
database queries.
"""
```

However, for schema modules, it's useful to list the fields and what they represent.

## i18n

When translating files, make sure the translations are consistent across the application. For example, if you have a translation for "Hello" in one file, ensure it's the same in all other files. Take care to maintain the context of the message to ensure accurate translations in similar scenarios.

```

```
