defmodule Zoonk.Locations.Country do
  @moduledoc """
  Represents a country's data.

  We use this mainly for billing and legal purposes.
  """
  alias Zoonk.Locations.Currency

  @enforce_keys [:iso2, :iso3, :name, :currency]
  defstruct [:iso2, :iso3, :name, :currency]

  @type t :: %__MODULE__{
          iso2: String.t(),
          iso3: String.t(),
          name: String.t(),
          currency: Currency.t()
        }
end
