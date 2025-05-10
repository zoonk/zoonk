defmodule Zoonk.Repo.Migrations.CreateOrgSettingsTable do
  use Ecto.Migration

  def change do
    create table(:org_settings) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false

      add :allowed_domains, {:array, :string}, default: []

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:org_settings, [:org_id])
  end
end
