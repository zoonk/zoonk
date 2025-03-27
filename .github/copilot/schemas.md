## Schemas

- Use the schema context as the module prefix (e.g., `Zoonk.Accounts.User`).
- Add a `@moduledoc` to each schema, explaining its purpose and the fields it contains. Use a table to clearly display the fields and their descriptions. Include three columns: Field Name, Type, and Description.
- Add `timestamps(type: :utc_datetime)` to all schemas.
- When writing or updating a schema, also create a migration file for it. Use `mix ecto.gen.migration` to generate the migration file or store it at `priv/repo/migrations/` with a timestamp prefix.
- When using a schema module, use `alias Zoonk.Accounts.User` to avoid long module names.
