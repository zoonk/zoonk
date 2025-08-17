defmodule Zoonk.Repo.Migrations.CreateUserProfilesTable do
  use Ecto.Migration

  def change do
    execute "CREATE EXTENSION IF NOT EXISTS pg_trgm", ""

    create table(:user_profiles) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :is_public, :boolean, null: false, default: false
      add :display_name, :text
      add :picture_url, :string
      add :username, :citext, null: false
      add :bio, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:user_profiles, [:username])
    create unique_index(:user_profiles, [:user_id])

    create index(:user_profiles, [~s("display_name" gin_trgm_ops)], using: "GIN")

    create index(:user_profiles, [~s("display_name" gin_trgm_ops)],
             using: "GIN",
             where: "is_public = true",
             name: "user_profiles__display_name_public__gin_trgm_ops_index"
           )
  end
end
