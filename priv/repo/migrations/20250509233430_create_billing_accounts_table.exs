defmodule Zoonk.Repo.Migrations.CreateBillingAccountsTable do
  use Ecto.Migration

  def change do
    create table(:billing_accounts) do
      add :user_id, references(:users, on_delete: :delete_all)
      add :org_id, references(:orgs, on_delete: :delete_all)

      add :currency, :string, null: false
      add :stripe_customer_id, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:billing_accounts, [:user_id])
    create unique_index(:billing_accounts, [:org_id])
    create index(:billing_accounts, [:stripe_customer_id])
  end
end
