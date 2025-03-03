defmodule Zoonk.Repo.Migrations.CreateCountriesTable do
  use Ecto.Migration

  def change do
    create table(:countries) do
      add :name, :string
      add :iso3, :string
      add :iso2, :string
      add :numeric_code, :string
      add :phonecode, :string
      add :capital, :string
      add :currency, :string
      add :currency_name, :string
      add :currency_symbol, :string
      add :tld, :string
      add :native, :string
      add :region, :string
      add :subregion, :string
      add :latitude, :decimal
      add :longitude, :decimal
      add :emoji, :string
      add :emojiU, :string
      add :timezones, :string
      add :translations, :string
      add :wikiDataId, :string
      add :created_at, :naive_datetime
      add :updated_at, :naive_datetime

      add :region_id, references(:regions)
      add :subregion_id, references(:subregions)
    end
  end
end
