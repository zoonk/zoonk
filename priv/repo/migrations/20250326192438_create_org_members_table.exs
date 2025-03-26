defmodule Zoonk.Repo.Migrations.CreateOrgMembersTable do
  use Ecto.Migration

  def change do
    create table(:org_members) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :role, :string, null: false, default: "member"

      timestamps(type: :utc_datetime)
    end

    create unique_index(:org_members, [:org_id, :user_id])
    create index(:org_members, [:org_id])
    create index(:org_members, [:user_id])
    create index(:org_members, [:org_id, :inserted_at])
    create index(:org_members, [:org_id, :role])
  end
end
