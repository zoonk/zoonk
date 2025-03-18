defmodule Zoonk.Locations.State do
  @moduledoc """
  Defines the `State` schema.

  We are using a [public database](https://github.com/dr5hn/countries-states-cities-database)
  for fetching all regions.
  """
  use Ecto.Schema

  schema "states" do
    field :name, :string
    field :country_code, :string
    field :fips_code, :string
    field :iso2, :string
    field :type, :string
    field :latitude, :decimal
    field :longitude, :decimal
    field :wikiDataId, :string
    field :created_at, :naive_datetime
    field :updated_at, :naive_datetime

    belongs_to :country, Zoonk.Locations.Country

    has_many :cities, Zoonk.Locations.City
  end
end
