defmodule Zoonk.Repo.Migrations.CreateInterestTranslations do
  use Ecto.Migration

  def change do
    create table(:interest_translations) do
      add :interest_id, references(:interests, on_delete: :delete_all), null: false

      add :language, :string, null: false, default: "en"
      add :title, :text, null: false
      add :description, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:interest_translations, [:interest_id])
    create index(:interest_translations, [:language])
    create unique_index(:interest_translations, [:interest_id, :language])
  end
end
