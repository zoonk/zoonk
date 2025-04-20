defmodule Zoonk.Repo.Migrations.CreateSpecializationCourses do
  use Ecto.Migration

  def change do
    create table(:specialization_courses) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :specialization_id, references(:specializations, on_delete: :delete_all), null: false
      add :course_id, references(:courses, on_delete: :delete_all), null: false

      add :level, :integer, null: false
      add :position, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:specialization_courses, [:org_id, :specialization_id])
    create index(:specialization_courses, [:org_id, :specialization_id, :level])
    create index(:specialization_courses, [:org_id, :course_id])

    create unique_index(:specialization_courses, [:org_id, :specialization_id, :course_id])
  end
end
