defmodule Zoonk.Repo.Migrations.CreateCourseTranslations do
  use Ecto.Migration

  def change do
    create table(:course_translations) do
      add :org_id, :bigint, null: false

      add :course_id,
          references(:courses, on_delete: :delete_all, with: [org_id: :org_id], match: :full),
          null: false

      add :language, :string, null: false, default: "en"
      add :title, :text, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_translations, [:course_id, :language])

    create index(:course_translations, [:org_id, :language])
    create index(:course_translations, [~s("title" gin_trgm_ops)], using: "GIN")
  end
end
