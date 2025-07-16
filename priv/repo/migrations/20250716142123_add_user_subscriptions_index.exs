defmodule Zoonk.Repo.Migrations.AddUserSubscriptionsIndex do
  use Ecto.Migration

  def change do
    create index(:user_subscriptions, [:user_id, :org_id, :status])
  end
end
