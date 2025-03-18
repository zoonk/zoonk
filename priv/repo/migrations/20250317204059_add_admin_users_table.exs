defmodule Zoonk.Repo.Migrations.AddAdminUsersTable do
  use Ecto.Migration

  def change do
    create table(:admin_users) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:admin_users, [:user_id])
  end
end
