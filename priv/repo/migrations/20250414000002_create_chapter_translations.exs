defmodule Zoonk.Repo.Migrations.CreateChapterTranslations do
  use Ecto.Migration

  def change do
    create table(:chapter_translations) do
      add :org_id, :bigint, null: false

      add :chapter_id,
          references(:chapters, on_delete: :delete_all, with: [org_id: :org_id], match: :full),
          null: false

      add :language, :string, null: false
      add :title, :text, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:chapter_translations, [:chapter_id, :language])

    create index(:chapter_translations, [:org_id, :language])
    create index(:chapter_translations, [~s("title" gin_trgm_ops)], using: "GIN")
  end
end
