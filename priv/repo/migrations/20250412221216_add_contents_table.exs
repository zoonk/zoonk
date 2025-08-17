defmodule Zoonk.Repo.Migrations.AddContentsTable do
  use Ecto.Migration

  def change do
    create table(:contents) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :kind, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:contents, [:org_id])
    create index(:contents, [:org_id, :kind])
  end
end
