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
  Lists all unique currencies from all countries.

  Returns a list of unique currency codes and names sorted alphabetically.

  ## Examples

      iex> list_currencies()
      [
        {"USD", "United States Dollar"},
        {"EUR", "Euro"},
        {"GBP", "British Pound Sterling"}
      ]
  """
  def list_currencies do
    list_countries()
    |> Enum.map(& &1.currency)
    |> Enum.uniq_by(& &1.code)
    |> Enum.map(&{&1.code, &1.name})
    |> Enum.sort_by(&elem(&1, 1))
  end

  @doc """
  Gets the default currency for a country by its ISO2 code.

  Returns the currency code if found, nil otherwise.

  ## Examples

      iex> get_country_currency("US")
      "USD"

      iex> get_country_currency("XX")
      nil
  """
  def get_country_currency(iso2_code) do
    case get_country(iso2_code) do
      %{currency: %{code: code}} -> code
      _ -> nil
    end
  end

  @doc """
  Lists available tax ID types for a given country.

  Returns a list of {value, label} tuples for tax ID types supported by the country.

  ## Examples

      iex> list_tax_id_types("US")
      [
        {"us_ein", "EIN (Employer Identification Number)"},
        {"us_ssn", "SSN (Social Security Number)"}
      ]

      iex> list_tax_id_types("XX")
      []
  """
  def list_tax_id_types(country_iso2) do
    case String.upcase(country_iso2) do
      "US" ->
        [
          {"us_ein", "EIN (Employer Identification Number)"},
          {"us_ssn", "SSN (Social Security Number)"}
        ]

      "CA" ->
        [
          {"ca_bn", "BN (Business Number)"},
          {"ca_sin", "SIN (Social Insurance Number)"}
        ]

      "GB" ->
        [
          {"gb_vat", "VAT (Value Added Tax)"},
          {"gb_utr", "UTR (Unique Taxpayer Reference)"}
        ]

      "DE" ->
        [
          {"de_vat", "VAT (Value Added Tax)"},
          {"de_tin", "TIN (Tax Identification Number)"}
        ]

      "FR" ->
        [
          {"fr_vat", "VAT (Value Added Tax)"},
          {"fr_siren", "SIREN (Business Registration Number)"}
        ]

      "AU" ->
        [
          {"au_abn", "ABN (Australian Business Number)"},
          {"au_arn", "ARN (Australian Registered Number)"}
        ]

      "BR" ->
        [
          {"br_cnpj", "CNPJ (Corporate Taxpayer ID)"},
          {"br_cpf", "CPF (Individual Taxpayer ID)"}
        ]

      "IN" ->
        [
          {"in_gst", "GST (Goods and Services Tax Number)"},
          {"in_pan", "PAN (Permanent Account Number)"}
        ]

      "JP" ->
        [
          {"jp_cn", "CN (Corporate Number)"},
          {"jp_rn", "RN (Registration Number)"}
        ]

      "MX" ->
        [
          {"mx_rfc", "RFC (Tax Registration Number)"}
        ]

      _ ->
        []
    end
  end
end
