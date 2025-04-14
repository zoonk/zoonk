defmodule Zoonk.Repo.Migrations.CreateUserInterests do
  use Ecto.Migration

  def change do
    create table(:user_interests) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :interest_id, references(:interests, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:user_interests, [:user_id])
    create index(:user_interests, [:interest_id])
    create unique_index(:user_interests, [:user_id, :interest_id])
  end
end
