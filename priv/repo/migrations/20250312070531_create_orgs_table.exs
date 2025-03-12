defmodule Zoonk.Repo.Migrations.CreateOrgsTable do
  use Ecto.Migration

  def change do
    create table(:orgs) do
      add :currency, :string, null: false, default: "USD"
      add :kind, :string, null: false, default: "business"
      add :subdomain, :string, null: false
      add :custom_domain, :string
      add :stripe_customer_id, :string
      add :tax_id, :binary

      timestamps(type: :utc_datetime)
    end

    create unique_index(:orgs, [:subdomain])
    create unique_index(:orgs, [:custom_domain])
  end
end
