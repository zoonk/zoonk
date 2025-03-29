defmodule Zoonk.Repo.Migrations.CreateOrgSettingsTable do
  use Ecto.Migration

  def change do
    create table(:org_settings) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false

      add :currency, :string, null: false, default: "USD"
      add :stripe_customer_id, :string
      add :tax_id, :binary
      add :allowed_domains, {:array, :string}, default: []

      timestamps(type: :utc_datetime)
    end

    create unique_index(:org_settings, [:org_id])
  end
end
