defmodule Zoonk.Repo.Migrations.CreateUserInterestsTable do
  use Ecto.Migration

  def change do
    create table(:user_interests) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :interests, :text
      add :learning_struggles, :text
      add :work_field, :text
      add :location, :text
      add :favorite_media, :text
      add :hobbies, :text
      add :preferred_examples, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:user_interests, [:user_id])
  end
end
