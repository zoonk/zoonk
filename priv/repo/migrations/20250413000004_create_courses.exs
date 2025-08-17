defmodule Zoonk.Repo.Migrations.CreateCourses do
  use Ecto.Migration

  def change do
    create table(:courses) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :content_id, references(:contents, on_delete: :delete_all), null: false

      add :categories, {:array, :string}, null: false, default: []
      add :thumb_url, :string
      add :slug, :citext, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:courses, [:org_id])
    create unique_index(:courses, [:slug])
    create unique_index(:courses, [:content_id])
  end
end
