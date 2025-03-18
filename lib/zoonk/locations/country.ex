defmodule Zoonk.Locations.Country do
  @moduledoc """
  Defines the `Country` schema.

  We are using a [public database](https://github.com/dr5hn/countries-states-cities-database)
  for fetching all regions.
  """
  use Ecto.Schema

  schema "countries" do
    field :name, :string
    field :iso3, :string
    field :iso2, :string
    field :numeric_code, :string
    field :phonecode, :string
    field :capital, :string
    field :currency, :string
    field :currency_name, :string
    field :currency_symbol, :string
    field :tld, :string
    field :native, :string
    field :region, :string
    field :subregion, :string
    field :latitude, :decimal
    field :longitude, :decimal
    field :emoji, :string
    field :emojiU, :string
    field :timezones, :string
    field :translations, :string
    field :wikiDataId, :string
    field :created_at, :naive_datetime
    field :updated_at, :naive_datetime

    belongs_to :region_data, Zoonk.Locations.Region, foreign_key: :region_id
    belongs_to :subregion_data, Zoonk.Locations.Subregion, foreign_key: :subregion_id

    has_many :states, Zoonk.Locations.State
    has_many :cities, Zoonk.Locations.City
  end
end
