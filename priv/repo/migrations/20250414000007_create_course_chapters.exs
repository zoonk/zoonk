defmodule Zoonk.Repo.Migrations.CreateCourseChapters do
  use Ecto.Migration

  def change do
    create table(:course_chapters) do
      add :course_id, references(:courses, on_delete: :delete_all), null: false
      add :chapter_id, references(:chapters, on_delete: :delete_all), null: false

      add :position, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_chapters, [:course_id, :chapter_id])

    create index(:course_chapters, [:course_id, :position])
  end
end
