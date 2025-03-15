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

      timestamps(type: :utc_datetime)
    end

    create table(:user_identities) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :is_primary, :boolean, default: false, null: false
      add :identity, :string, null: false
      add :identity_id, :citext, null: false
      add :confirmed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_identities, [:identity, :identity_id])
    create unique_index(:user_identities, [:user_id], where: "is_primary = true")
    create index(:user_identities, [:user_id, :identity])

    create table(:users_tokens) do
      add :user_identity_id, references(:user_identities, on_delete: :delete_all), null: false

      add :token, :binary, null: false
      add :context, :string, null: false
      add :sent_to, :string

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:users_tokens, [:user_identity_id])
    create unique_index(:users_tokens, [:context, :token])

    create table(:user_profiles) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :city_id, references(:cities, on_delete: :nothing)

      add :is_public, :boolean, null: false, default: false

      add :display_name, :citext
      add :picture_url, :string
      add :username, :citext, null: false

      add :bio, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_profiles, [:username])
    create unique_index(:user_profiles, [:user_id])
  end
end
