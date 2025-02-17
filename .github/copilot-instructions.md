## Ecto

When querying, use the pipe-friendly syntax for better readability and composability. Instead of:

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

## i18n

When translating files, make sure the translations are consistent across the application. For example, if you have a translation for "Hello" in one file, ensure it's the same in all other files. Take care to maintain the context of the message to ensure accurate translations in similar scenarios.
