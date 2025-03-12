defmodule Zoonk.Repo.Migrations.CreateMembersTable do
  use Ecto.Migration

  def change do
    create table(:members) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :team_id, references(:teams, on_delete: :delete_all)
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :role, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:members, [:org_id, :team_id, :user_id])
    create index(:members, [:org_id])
    create index(:members, [:team_id])
    create index(:members, [:user_id])
    create index(:members, [:org_id, :team_id, :role])
    create index(:members, [:team_id, :role])
  end
end
