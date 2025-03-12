defmodule Zoonk.Repo.Migrations.CreateOrgProfilesTable do
  use Ecto.Migration

  def change do
    create table(:org_profiles) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :city_id, :integer

      add :display_name, :citext, null: false
      add :bio, :string
      add :public_email, :citext
      add :icon_url, :string
      add :logo_url, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:org_profiles, [:org_id])
    create index(:org_profiles, [:city_id])
    create index(:org_profiles, [:display_name])
  end
end
