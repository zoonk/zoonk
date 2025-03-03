defmodule Zoonk.Schemas.Subregion do
  @moduledoc """
  Defines the `Subregion` schema.

  We are using a [public database](https://github.com/dr5hn/countries-states-cities-database)
  for fetching all regions.
  """
  use Ecto.Schema

  schema "subregions" do
    field :name, :string
    field :translations, :string
    field :wikiDataId, :string
    field :created_at, :naive_datetime
    field :updated_at, :naive_datetime

    belongs_to :region, Zoonk.Schemas.Region
    has_many :countries, Zoonk.Schemas.Country
  end
end
