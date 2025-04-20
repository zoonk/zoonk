defmodule Zoonk.Repo.Migrations.CreateSpecializationTranslations do
  use Ecto.Migration

  def change do
    create table(:specialization_translations) do
      add :specialization_id, references(:specializations, on_delete: :delete_all), null: false

      add :language, :string, null: false, default: "en"
      add :title, :citext, null: false
      add :slug, :citext, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:specialization_translations, [:specialization_id])
    create unique_index(:specialization_translations, [:specialization_id, :language])
    create unique_index(:specialization_translations, [:language, :slug])
  end
end
