defmodule Zoonk.Repo.Migrations.CreateUsersAuthTables do
  use Ecto.Migration

  def change do
    execute "CREATE EXTENSION IF NOT EXISTS citext", ""

    create table(:users) do
      add :year_of_birth, :integer

      add :tax_id, :binary

      add :kind, :string, null: false
      add :currency, :string, null: false, default: "USD"
      add :language, :string, null: false, default: "en"
      add :stripe_customer_id, :string

      add :email, :citext

      add :confirmed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:users, [:email])
    create index(:users, [:kind])
    create index(:users, [:kind, :updated_at])

    create table(:users_tokens) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :token, :binary, null: false

      add :context, :string, null: false
      add :sent_to, :string
      add :authenticated_at, :utc_datetime_usec

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:users_tokens, [:user_id])
    create unique_index(:users_tokens, [:context, :token])
  end
end
