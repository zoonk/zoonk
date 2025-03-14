defmodule Zoonk.Repo.Migrations.CreateUserIdentitiesTable do
  use Ecto.Migration

  def change do
    create table(:user_identities) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :is_primary, :boolean, default: false, null: false

      add :identity, :string, null: false
      add :identity_id, :citext, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_identities, [:identity, :identity_id])
    create unique_index(:user_identities, [:user_id], where: "is_primary = true")
    create index(:user_identities, [:user_id, :identity])
  end
end
