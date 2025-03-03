defmodule Zoonk.Schemas.Region do
  @moduledoc """
  Defines the `Region` schema.

  We are using a [public database](https://github.com/dr5hn/countries-states-cities-database)
  for fetching all regions.
  """
  use Ecto.Schema

  schema "regions" do
    field :name, :string
    field :translations, :string
    field :wikiDataId, :string
    field :created_at, :naive_datetime
    field :updated_at, :naive_datetime

    has_many :subregions, Zoonk.Schemas.Subregion
    has_many :countries, Zoonk.Schemas.Country
  end
end
