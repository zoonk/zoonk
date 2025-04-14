defmodule Zoonk.Repo.Migrations.CreateCourseUsers do
  use Ecto.Migration

  def change do
    create table(:course_users) do
      add :course_id, references(:courses, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :role, :string, null: false, default: "member"

      timestamps(type: :utc_datetime_usec)
    end

    create index(:course_users, [:course_id])
    create index(:course_users, [:user_id])
    create unique_index(:course_users, [:course_id, :user_id])
  end
end
