defmodule Zoonk.Repo.Migrations.CreateCourseSuggestions do
  use Ecto.Migration

  def change do
    create table(:course_suggestions) do
      add :content_id, references(:contents, on_delete: :delete_all), null: false

      add :query, :citext, null: false
      add :language, :string, null: false
      add :suggestions, {:array, :map}, null: false, default: []

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_suggestions, [:content_id])
    create unique_index(:course_suggestions, [:query, :language])
  end
end
