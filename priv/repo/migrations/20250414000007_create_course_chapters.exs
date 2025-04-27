defmodule Zoonk.Repo.Migrations.CreateCourseChapters do
  use Ecto.Migration

  def change do
    create table(:course_chapters) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :course_id, references(:courses, on_delete: :delete_all), null: false
      add :chapter_id, references(:chapters, on_delete: :delete_all), null: false

      add :position, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:course_chapters, [:org_id, :course_id])
    create unique_index(:course_chapters, [:org_id, :course_id, :course_id])
  end
end
