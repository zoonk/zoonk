defmodule Zoonk.Repo.Migrations.CreateCourseUsers do
  use Ecto.Migration

  def change do
    create table(:course_users) do
      add :org_id, :bigint, null: false

      add :course_id,
          references(:courses, on_delete: :delete_all, with: [org_id: :org_id], match: :full),
          null: false

      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :role, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_users, [:org_id, :course_id, :user_id])

    create index(:course_users, [:org_id, :course_id, :inserted_at])
    create index(:course_users, [:org_id, :course_id, :role, :inserted_at])
    create index(:course_users, [:user_id, :inserted_at])
    create index(:course_users, [:user_id, :role, :inserted_at])
  end
end
