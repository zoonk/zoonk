defmodule Zoonk.FuzzySearchTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.FuzzySearch

  describe "search/4" do
    test "returns all items when query is nil" do
      items = ["apple", "banana", "cherry"]
      result = FuzzySearch.search(items, nil)
      assert result == items
    end

    test "returns all items when query is empty string" do
      items = ["apple", "banana", "cherry"]
      result = FuzzySearch.search(items, "")
      assert result == items
    end

    test "performs exact substring matching" do
      items = ["Settings", "Profile", "Help", "Getting Started"]
      result = FuzzySearch.search(items, "sett")
      assert result == ["Settings"]
    end

    test "performs case-insensitive matching" do
      items = ["Settings", "Profile", "Help"]
      result = FuzzySearch.search(items, "SETT")
      assert result == ["Settings"]
    end

    test "uses fuzzy matching with Jaro distance" do
      items = ["test", "toast", "taste"]
      result = FuzzySearch.search(items, "tst", & &1, 0.6)
      assert "test" in result
    end

    test "accepts custom match function for complex data structures" do
      items = [
        %{name: "Getting Started", category: "guide"},
        %{name: "Profile Settings", category: "settings"},
        %{name: "Help Center", category: "support"}
      ]

      result = FuzzySearch.search(items, "start", & &1.name)
      assert result == [%{name: "Getting Started", category: "guide"}]
    end

    test "handles custom threshold values" do
      items = ["test", "toast", "taste", "completely_different"]

      # With lower threshold, more items match
      result_low = FuzzySearch.search(items, "tst", & &1, 0.5)
      result_high = FuzzySearch.search(items, "tst", & &1, 0.9)

      assert length(result_low) >= length(result_high)
      refute "completely_different" in result_high
    end

    test "handles threshold as third parameter" do
      items = ["test", "toast", "taste"]
      result = FuzzySearch.search(items, "tst", 0.8)
      assert is_list(result)
    end

    test "returns empty list when no matches found" do
      items = ["apple", "banana", "cherry"]
      result = FuzzySearch.search(items, "xyz", & &1, 0.9)
      assert result == []
    end

    test "works with empty items list" do
      result = FuzzySearch.search([], "query")
      assert result == []
    end
  end
end
