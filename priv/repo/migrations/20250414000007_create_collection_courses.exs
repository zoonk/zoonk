defmodule Zoonk.Repo.Migrations.CreateCollectionCourses do
  use Ecto.Migration

  def change do
    create table(:collection_courses) do
      add :collection_id, references(:collections, on_delete: :delete_all), null: false
      add :course_id, references(:courses, on_delete: :delete_all), null: false

      add :position, :integer, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:collection_courses, [:collection_id])
    create index(:collection_courses, [:course_id])
    create unique_index(:collection_courses, [:collection_id, :course_id])
  end
end
