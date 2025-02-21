defmodule Zoonk.Repo.Migrations.CreateUserProfilesTable do
  use Ecto.Migration

  def change do
    create table(:user_profiles) do
      add :public?, :boolean, null: false, default: false
      add :bio, :text
      add :display_name, :string
      add :picture_url, :string
      add :username, :citext, null: false

      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_profiles, [:username])
    create unique_index(:user_profiles, [:user_id])
  end
end
