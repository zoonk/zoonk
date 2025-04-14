defmodule Zoonk.Repo.Migrations.CreateCollectionTranslations do
  use Ecto.Migration

  def change do
    create table(:collection_translations) do
      add :collection_id, references(:collections, on_delete: :delete_all), null: false

      add :language, :string, null: false, default: "en"
      add :title, :citext, null: false
      add :slug, :citext, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:collection_translations, [:collection_id])
    create unique_index(:collection_translations, [:collection_id, :language])
    create unique_index(:collection_translations, [:language, :slug])
  end
end
