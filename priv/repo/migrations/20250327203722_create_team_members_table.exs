defmodule Zoonk.Repo.Migrations.CreateTeamMembersTable do
  use Ecto.Migration

  def change do
    create table(:team_members) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :team_id, references(:teams, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :role, :string, null: false, default: "member"

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:team_members, [:org_id, :team_id, :user_id])
    create index(:team_members, [:user_id])
  end
end
