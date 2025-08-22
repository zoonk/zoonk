defmodule Zoonk.Repo.Migrations.CreateUserInterestsTable do
  use Ecto.Migration

  def change do
    create table(:user_interests) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :examples, :text
      add :hobbies, :text
      add :location, :text
      add :media, :text
      add :struggles, :text
      add :work_field, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:user_interests, [:user_id])
  end
end
