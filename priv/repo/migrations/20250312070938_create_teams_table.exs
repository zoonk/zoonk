defmodule Zoonk.Repo.Migrations.CreateTeamsTable do
  use Ecto.Migration

  def change do
    create table(:teams) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false

      add :name, :string, null: false
      add :slug, :string, null: false
      add :description, :string
      add :logo_url, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:teams, [:org_id, :slug])
    create index(:teams, [:org_id])
    create index(:teams, [:org_id, :name])
  end
end
