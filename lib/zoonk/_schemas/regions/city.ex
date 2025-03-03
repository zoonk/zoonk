defmodule Zoonk.Schemas.City do
  @moduledoc """
  Defines the `City` schema.

  We are using a [public database](https://github.com/dr5hn/countries-states-cities-database)
  for fetching all regions.
  """
  use Ecto.Schema

  schema "cities" do
    field :name, :string
    field :state_code, :string
    field :country_code, :string
    field :latitude, :decimal
    field :longitude, :decimal
    field :wikiDataId, :string
    field :created_at, :naive_datetime
    field :updated_at, :naive_datetime

    belongs_to :country, Zoonk.Schemas.Country
    belongs_to :state, Zoonk.Schemas.State
  end
end
