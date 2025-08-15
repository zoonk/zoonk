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
      assert us
      assert us.iso2 == "US"
      assert us.currency.code == "USD"

      us_lower = Locations.get_country("us")
      assert us_lower
      assert us_lower.iso2 == "US"
    end

    test "returns nil for an invalid ISO2 code" do
      assert Locations.get_country("XX") == nil
      assert Locations.get_country(123) == nil
      assert Locations.get_country("") == nil
      assert Locations.get_country(nil) == nil
    end
  end

  describe "country_name/1" do
    test "returns the correct country name for a valid ISO2 code (case-insensitive)" do
      assert Locations.country_name("US") == "United States"
      assert Locations.country_name("us") == "United States"
    end

    test "returns nil for an invalid ISO2 code" do
      assert Locations.country_name("XX") == nil
      assert Locations.country_name(123) == nil
      assert Locations.country_name("") == nil
      assert Locations.country_name(nil) == nil
    end
  end

  describe "currency_symbol/1" do
    test "returns the correct symbol for valid currency codes (case-insensitive)" do
      assert Locations.currency_symbol("USD") == "$"
      assert Locations.currency_symbol("usd") == "$"
      assert Locations.currency_symbol("BRL") == "R$"
      assert Locations.currency_symbol("brl") == "R$"
      assert Locations.currency_symbol("EUR") == "€"
      assert Locations.currency_symbol("eur") == "€"
      assert Locations.currency_symbol("JPY") == "¥"
      assert Locations.currency_symbol("GBP") == "£"
    end

    test "returns nil for invalid currency codes" do
      assert Locations.currency_symbol("XXX") == nil
      assert Locations.currency_symbol("INVALID") == nil
      assert Locations.currency_symbol("") == nil
      assert Locations.currency_symbol(nil) == nil
      assert Locations.currency_symbol(123) == nil
    end
  end
end
