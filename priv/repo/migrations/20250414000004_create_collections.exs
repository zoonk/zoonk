defmodule Zoonk.Repo.Migrations.CreateCollections do
  use Ecto.Migration

  def change do
    create table(:collections) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false

      add :categories, {:array, :string}, null: false, default: []
      add :thumb_url, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:collections, [:org_id])
  end
end
