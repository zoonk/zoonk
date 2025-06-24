defmodule Zoonk.Repo.Migrations.CreateCourseRecommendations do
  use Ecto.Migration

  def change do
    create table(:course_recommendations) do
      add :query, :citext, null: false
      add :language, :string, null: false
      add :courses, {:array, :map}, null: false, default: []

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_recommendations, [:query, :language])
  end
end
