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
