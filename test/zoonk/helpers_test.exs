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
end
