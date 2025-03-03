defmodule Zoonk.Repo.Migrations.CreateCitiesTable do
  use Ecto.Migration

  def change do
    create table(:cities) do
      add :name, :string
      add :state_code, :string
      add :country_code, :string
      add :latitude, :decimal
      add :longitude, :decimal
      add :wikiDataId, :string
      add :created_at, :naive_datetime
      add :updated_at, :naive_datetime

      add :country_id, references(:countries)
      add :state_id, references(:states)
    end
  end
end
