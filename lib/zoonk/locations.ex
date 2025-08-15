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

  @doc """
  Gets a country name by its ISO2 code.

  ## Examples

      iex> country_name("US")
      "United States of America"

      iex> ountry_name("XX")
      nil
  """
  defdelegate country_name(iso2_code), to: CountryData

  @doc """
  Retrieves the symbol for a currency by its code.

  Returns the currency symbol if found, or `nil` if not found.

  ## Examples

      iex> currency_symbol("USD")
      "$"

      iex> currency_symbol("BRL")
      "R$"

      iex> currency_symbol("EUR")
      "€"

      iex> currency_symbol("XXX")
      nil
  """
  defdelegate currency_symbol(currency_code), to: CountryData
end
