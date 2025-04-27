defmodule Zoonk.Repo.Migrations.CreateChapterTranslations do
  use Ecto.Migration

  def change do
    create table(:chapter_translations) do
      add :chapter_id, references(:chapters, on_delete: :delete_all), null: false
      add :language, :string, null: false
      add :title, :citext, null: false
      add :slug, :citext, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:chapter_translations, [:chapter_id])
    create unique_index(:chapter_translations, [:chapter_id, :language])
    create unique_index(:chapter_translations, [:language, :slug])
  end
end
