defmodule Zoonk.Repo.Migrations.CreateStatesTable do
  use Ecto.Migration

  def change do
    create table(:states) do
      add :name, :string
      add :country_code, :string
      add :fips_code, :string
      add :iso2, :string
      add :type, :string
      add :latitude, :decimal
      add :longitude, :decimal
      add :wikiDataId, :string
      add :created_at, :naive_datetime
      add :updated_at, :naive_datetime

      add :country_id, references(:countries)
    end
  end
end
