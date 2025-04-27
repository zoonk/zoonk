defmodule Zoonk.Repo.Migrations.CreateChapters do
  use Ecto.Migration

  def change do
    create table(:chapters) do
      add :org_id, references(:orgs, on_delete: :delete_all), null: false
      add :course_id, references(:courses, on_delete: :nilify_all)

      add :slug, :citext, null: false
      add :thumb_url, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:chapters, [:org_id])
    create index(:chapters, [:org_id, :slug])
    create unique_index(:chapters, [:slug])
  end
end
