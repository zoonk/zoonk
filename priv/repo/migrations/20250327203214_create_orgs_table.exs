defmodule Zoonk.Repo.Migrations.CreateOrgsTable do
  use Ecto.Migration

  def change do
    create table(:orgs) do
      add :currency, :string, null: false, default: "USD"
      add :kind, :string, null: false, default: "team"
      add :stripe_customer_id, :string
      add :tax_id, :binary

      timestamps(type: :utc_datetime)
    end

    create index(:orgs, [:kind])
    create index(:orgs, [:inserted_at])
  end
end
