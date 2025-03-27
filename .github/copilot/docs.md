## Documentation

- Keep documentation clear and concise.
- Avoid vague phrases like “ensures reliability” or “handles securely” and judgmental terms like “essential” or “best practices.” Instead, explain what the module does and how it works. If it follows a security measure or a recommended approach, state that directly rather than making broad claims.
- In `@moduledoc`, avoid listing all functions. Instead, use `@doc` for function-specific documentation.
- Add examples to `@doc` for each function, especially if the function is complex or has multiple parameters. Use `@doc` to explain the purpose of each function and its parameters.
- Keep the first line of a `@moduledoc` or `@doc` brief. For example, _Handles token generation for authentication_ is better than _Handles the generation of authentication tokens for different contexts, such as sessions and email-based authentication._
- For code examples, don’t use `elixir` at the beginning, as it doesn’t work well with Elixir docs. Use tabs/spaces instead.
- When creating a new guide, add it to the `extras` section in the `mix.exs` file.
