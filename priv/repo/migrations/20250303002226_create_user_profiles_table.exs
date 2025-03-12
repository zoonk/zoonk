defmodule Zoonk.Repo.Migrations.CreateUserProfilesTable do
  use Ecto.Migration

  def change do
    create table(:user_profiles) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :city_id, :integer

      add :public?, :boolean, null: false, default: false

      add :display_name, :citext
      add :picture_url, :string
      add :username, :citext, null: false

      add :bio, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_profiles, [:username])
    create unique_index(:user_profiles, [:user_id])
  end
end
