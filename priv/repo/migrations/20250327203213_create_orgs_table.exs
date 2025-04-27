defmodule Zoonk.Repo.Migrations.CreateOrgsTable do
  use Ecto.Migration

  def change do
    create table(:orgs) do
      add :city_id, references(:cities, on_delete: :nothing)

      add :kind, :string, null: false, default: "team"
      add :display_name, :text, null: false
      add :bio, :string
      add :public_email, :citext
      add :icon_url, :string
      add :logo_url, :string

      add :subdomain, :citext, null: false
      add :custom_domain, :citext

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:orgs, [:subdomain])
    create unique_index(:orgs, [:custom_domain])
    create unique_index(:orgs, [:kind], where: "kind = 'app'", name: "orgs_kind_app_index")
    create index(:orgs, [:kind])
    create index(:orgs, [:city_id])
    create index(:orgs, [:display_name])
  end
end
