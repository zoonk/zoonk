defmodule Zoonk.Repo.Migrations.CreateLearningRecommendations do
  use Ecto.Migration

  def change do
    create table(:learning_recommendations) do
      add :query, :citext, null: false
      add :language, :string, null: false
      add :recommendations, {:array, :map}, null: false, default: []

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:learning_recommendations, [:query, :language])
  end
end
