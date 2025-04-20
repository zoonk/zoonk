defmodule Zoonk.Repo.Migrations.CreateSpecializations do
  use Ecto.Migration

  def change do
    create table(:specializations) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false

      add :categories, {:array, :string}, null: false, default: []
      add :thumb_url, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:specializations, [:org_id])
  end
end
