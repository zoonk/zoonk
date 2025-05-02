defmodule Zoonk.HelpersTest do
  use Zoonk.DataCase, async: true

  import Zoonk.Helpers

  describe "get_context_from_module/1" do
    test "returns the scope for ZoonkWeb modules" do
      assert :catalog = get_context_from_module(ZoonkWeb.Catalog.CatalogHomeLive)
      assert :org = get_context_from_module(ZoonkWeb.Org.OrgHomeLive)
      assert :library = get_context_from_module(ZoonkWeb.Library)
    end

    test "returns the scope for Zoonk modules" do
      assert :accounts = get_context_from_module(Zoonk.Accounts.User)
      assert :locations = get_context_from_module(Zoonk.Locations.Country)
      assert :library = get_context_from_module(Zoonk.Library)
    end

    test "returns the scope for string module names" do
      assert :catalog = get_context_from_module("ZoonkWeb.Catalog.CatalogHomeLive")
      assert :accounts = get_context_from_module("Zoonk.Accounts.User")
      assert :locations = get_context_from_module("Zoonk.Locations")
    end

    test "returns nil for invalid modules" do
      refute get_context_from_module(InvalidModule)
      refute get_context_from_module("InvalidModule")
    end

    test "returns nil for inexisting atoms" do
      refute get_context_from_module(Zoonk.ThisModuleDoesNotExist.Test)
    end
  end

  describe "to_snake_case/1" do
    test "converts a string with spaces to snake case" do
      assert to_snake_case("Hello World") == "hello_world"
    end

    test "converts a camel case string to snake case" do
      assert to_snake_case("HelloWorld") == "hello_world"
    end

    test "removes special characters and converts to snake case" do
      assert to_snake_case("Hello World!") == "hello_world"
    end

    test "handles single word strings" do
      assert to_snake_case("Hello") == "hello"
    end
  end

  describe "fuzzy_search/4" do
    test "returns all items when query is nil or empty" do
      items = ["apple", "banana", "cherry"]

      assert fuzzy_search(items, nil) == items
      assert fuzzy_search(items, "") == items
    end

    test "finds exact substring matches" do
      items = ["apple pie", "banana bread", "cherry cake"]

      assert fuzzy_search(items, "apple") == ["apple pie"]
      assert fuzzy_search(items, "bread") == ["banana bread"]
    end

    test "finds fuzzy matches based on jaro distance" do
      items = ["settings", "profile", "account", "help"]

      assert fuzzy_search(items, "sett") == ["settings"]
      assert fuzzy_search(items, "prof") == ["profile"]
    end

    test "is case insensitive" do
      items = ["Settings", "PROFILE", "account", "Help"]

      assert fuzzy_search(items, "sett") == ["Settings"]
      assert fuzzy_search(items, "prof") == ["PROFILE"]
      assert fuzzy_search(items, "help") == ["Help"]
    end

    test "works with custom match functions" do
      items = [
        %{name: "Getting Started", id: 1},
        %{name: "User Settings", id: 2},
        %{name: "Account Profile", id: 3}
      ]

      assert fuzzy_search(items, "start", & &1.name) == [%{name: "Getting Started", id: 1}]
      assert fuzzy_search(items, "sett", & &1.name) == [%{name: "User Settings", id: 2}]
    end

    test "respects threshold parameter with and without match_fn" do
      items = ["test", "taste", "toast", "text"]

      assert items
             |> fuzzy_search("tst", 0.6)
             |> Enum.sort() == ["taste", "test", "text"]

      assert items
             |> fuzzy_search("tst", 0.8)
             |> Enum.sort() == ["taste", "test"]
    end
  end

  describe "remove_accents/1" do
    test "removes accents from Latin characters" do
      assert remove_accents("Café") == "Cafe"
      assert remove_accents("Crème brûlée") == "Creme brulee"
      assert remove_accents("naïve") == "naive"
    end

    test "handles strings without accents" do
      assert remove_accents("Hello World") == "Hello World"
      assert remove_accents("Testing 123") == "Testing 123"
    end

    test "removes other diacritical marks" do
      assert remove_accents("piñata") == "pinata"
      assert remove_accents("São Paulo") == "Sao Paulo"
      assert remove_accents("über") == "uber"
    end

    test "removes special characters" do
      assert remove_accents("café@home") == "cafehome"
      assert remove_accents("test#123") == "test123"
      assert remove_accents("hello-world") == "helloworld"
    end

    test "preserves alphanumeric characters and spaces" do
      assert remove_accents("Café 123") == "Cafe 123"
      assert remove_accents("Hello World 2025") == "Hello World 2025"
    end
  end

  describe "with_decoded_token/3" do
    test "applies the function to a successfully decoded token" do
      # "hello" encoded as URL-safe Base64
      encoded_token = "aGVsbG8"

      result =
        with_decoded_token(encoded_token, fn decoded ->
          assert decoded == "hello"
          String.upcase(decoded)
        end)

      assert result == "HELLO"
    end

    test "returns :error for invalid Base64 encoding" do
      invalid_token = "not-valid-base64!"

      result =
        with_decoded_token(invalid_token, fn _decoded ->
          flunk("This function should not be called")
        end)

      assert result == :error
    end

    test "returns custom error when a third argument is provided" do
      invalid_token = "not-valid-base64!"

      result =
        with_decoded_token(
          invalid_token,
          fn _decoded ->
            flunk("This function should not be called")
          end,
          nil
        )

      assert is_nil(result)
    end

    test "works with more complex functions" do
      # "token:123" encoded as URL-safe Base64
      encoded_token = "dG9rZW46MTIz"

      result =
        with_decoded_token(encoded_token, fn decoded ->
          [prefix, number] = String.split(decoded, ":")
          {prefix, String.to_integer(number)}
        end)

      assert result == {"token", 123}
    end
  end
end
