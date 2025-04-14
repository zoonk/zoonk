defmodule Zoonk.Repo.Migrations.CreateCourseTranslations do
  use Ecto.Migration

  def change do
    create table(:course_translations) do
      add :course_id, references(:courses, on_delete: :delete_all), null: false

      add :language, :string, null: false
      add :title, :citext, null: false
      add :slug, :citext, null: false
      add :description, :text

      timestamps(type: :utc_datetime)
    end

    create index(:course_translations, [:course_id])
    create unique_index(:course_translations, [:course_id, :language])
    create unique_index(:course_translations, [:language, :slug])
  end
end
