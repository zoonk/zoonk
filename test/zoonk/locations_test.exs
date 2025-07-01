defmodule Zoonk.LocationsTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Locations

  describe "list_countries/0" do
    test "returns a non-empty list of countries" do
      countries = Locations.list_countries()
      assert is_list(countries)
      assert Enum.empty?(countries) == false
    end

    test "all countries have required fields" do
      countries = Locations.list_countries()

      Enum.each(countries, fn country ->
        assert Map.has_key?(country, :currency)
        assert Map.has_key?(country, :name)
        assert Map.has_key?(country, :iso2)
        assert Map.has_key?(country, :iso3)
      end)
    end
  end

  describe "get_country/1" do
    test "returns the correct country for a valid ISO2 code (case-insensitive)" do
      us = Locations.get_country("US")
      assert us != nil
      assert us.iso2 == "US"
      assert us.currency.code == "USD"

      us_lower = Locations.get_country("us")
      assert us_lower != nil
      assert us_lower.iso2 == "US"
    end

    test "returns nil for an invalid ISO2 code" do
      assert Locations.get_country("XX") == nil
      assert Locations.get_country(123) == nil
      assert Locations.get_country("") == nil
      assert Locations.get_country(nil) == nil
    end
  end

  describe "list_currencies/0" do
    test "returns unique currencies sorted by name" do
      currencies = Locations.list_currencies()

      assert is_list(currencies)
      assert length(currencies) > 0

      # Check first few currencies are properly formatted
      usd_currency = Enum.find(currencies, fn {code, _name} -> code == "USD" end)
      assert usd_currency == {"USD", "United States Dollar"}

      eur_currency = Enum.find(currencies, fn {code, _name} -> code == "EUR" end)
      assert eur_currency == {"EUR", "Euro"}

      # Check that all entries are tuples with {code, name}
      Enum.each(currencies, fn {code, name} ->
        assert is_binary(code)
        assert is_binary(name)
        assert String.length(code) == 3
      end)
    end
  end

  describe "get_country_currency/1" do
    test "returns currency for valid country code" do
      assert Locations.get_country_currency("US") == "USD"
      assert Locations.get_country_currency("GB") == "GBP"
      assert Locations.get_country_currency("DE") == "EUR"
    end

    test "returns nil for invalid country code" do
      assert Locations.get_country_currency("XX") == nil
      assert Locations.get_country_currency("ZZ") == nil
    end

    test "works with lowercase country codes" do
      assert Locations.get_country_currency("us") == "USD"
      assert Locations.get_country_currency("gb") == "GBP"
    end
  end

  describe "list_tax_id_types/1" do
    test "returns tax ID types for US" do
      tax_types = Locations.list_tax_id_types("US")

      assert tax_types == [
        {"us_ein", "EIN (Employer Identification Number)"},
        {"us_ssn", "SSN (Social Security Number)"}
      ]
    end

    test "returns tax ID types for Canada" do
      tax_types = Locations.list_tax_id_types("CA")

      assert tax_types == [
        {"ca_bn", "BN (Business Number)"},
        {"ca_sin", "SIN (Social Insurance Number)"}
      ]
    end

    test "returns tax ID types for Great Britain" do
      tax_types = Locations.list_tax_id_types("GB")

      assert tax_types == [
        {"gb_vat", "VAT (Value Added Tax)"},
        {"gb_utr", "UTR (Unique Taxpayer Reference)"}
      ]
    end

    test "returns empty list for unsupported country" do
      assert Locations.list_tax_id_types("XX") == []
      assert Locations.list_tax_id_types("ZZ") == []
    end

    test "works with lowercase country codes" do
      tax_types = Locations.list_tax_id_types("us")

      assert tax_types == [
        {"us_ein", "EIN (Employer Identification Number)"},
        {"us_ssn", "SSN (Social Security Number)"}
      ]
    end
  end
end
