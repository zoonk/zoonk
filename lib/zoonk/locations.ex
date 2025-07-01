defmodule Zoonk.Locations do
  @moduledoc """
  Handles geographic and regional data.

  This data can be used for compliance, billing, and legal purposes.
  But it can also be extended to include more complex geographic operations
  in the future.
  """
  alias Zoonk.Locations.CountryData

  @doc """
  Lists all supported countries.

  Returns a list of `Zoonk.Locations.Country` structs containing ISO codes, names, and currency information.
  """
  defdelegate list_countries(), to: CountryData

  @doc """
  Retrieves a country by its ISO2 code.

  Returns a `Zoonk.Locations.Country` struct if found, or `nil` if not found.

  ## Examples

      iex> get_country("US")
      %Zoonk.Locations.Country{
        iso2: "US",
        iso3: "USA",
        name: "United States of America",
        currency: %Zoonk.Locations.Currency{code: "USD", name: "US Dollar"}
      }

      iex> get_country("XX")
      nil
  """
  defdelegate get_country(iso2_code), to: CountryData
end
