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
end
