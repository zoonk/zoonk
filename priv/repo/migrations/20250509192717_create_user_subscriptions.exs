defmodule Zoonk.Repo.Migrations.CreateUserSubscriptions do
  use Ecto.Migration

  def change do
    create table(:user_subscriptions) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :stripe_subscription_id, :string
      add :plan, :string, null: false
      add :payment_term, :string, null: false
      add :status, :string, null: false
      add :expires_at, :utc_datetime_usec
      add :cancel_at_period_end, :boolean, default: false, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_subscriptions, [:org_id, :user_id])
    create index(:user_subscriptions, [:stripe_subscription_id])
  end
end
