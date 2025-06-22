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
      items = ["Settings", "Profile", "Help", "Other"]
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

    test "handles typos correctly" do
      items = ["change", "charge", "exchange", "channel", "challenge"]

      # "chanhe" should match "change" first (best match)
      result = FuzzySearch.search(items, "chanhe")
      assert List.first(result) == "change"

      # "chnge" should also match "change"
      result2 = FuzzySearch.search(items, "chnge")
      assert List.first(result2) == "change"
    end

    test "ranks results by relevance" do
      items = ["Settings", "Set Password", "Reset Settings", "Get Started"]

      result = FuzzySearch.search(items, "set")

      # Exact substring matches should come first
      assert List.first(result) == "Settings"

      # Word-start matches should come next
      assert "Set Password" in result

      assert Enum.find_index(result, &(&1 == "Set Password")) <
               Enum.find_index(result, &(&1 == "Reset Settings"))
    end

    test "exact substring matches get highest priority" do
      items = ["test", "testing", "contest", "latest"]

      result = FuzzySearch.search(items, "test")

      # "test" should be first (exact match)
      assert List.first(result) == "test"

      # "testing" should be second (contains "test" at start)
      assert Enum.at(result, 1) == "testing"
    end

    test "word-start matching works correctly" do
      items = ["Getting Started", "Set Password", "Reset Everything", "Start Here"]

      result = FuzzySearch.search(items, "start")

      # Should match "Getting Started" and "Start Here"
      assert "Getting Started" in result
      assert "Start Here" in result
    end

    test "fuzzy matching with lenient threshold for typos" do
      items = ["profile", "project", "problem", "produce"]

      # "profle" (missing 'i') should match "profile"
      result = FuzzySearch.search(items, "profle")
      assert List.first(result) == "profile"

      # "projct" (missing 'e') should match "project"
      result2 = FuzzySearch.search(items, "projct")
      assert List.first(result2) == "project"
    end

    test "does not match completely unrelated words" do
      items = ["settings", "profile", "help", "logout"]

      # "xyz" should not match anything
      result = FuzzySearch.search(items, "xyz")
      assert result == []

      # Very different word should not match
      result2 = FuzzySearch.search(items, "banana")
      assert result2 == []
    end

    test "handles complex typos in command palette context" do
      items = ["Create New Post", "Edit Profile", "Change Password", "Manage Settings"]

      # Common typos in command palette
      # "create" with typo
      result1 = FuzzySearch.search(items, "crete")
      assert "Create New Post" in result1

      # "manage" with typo
      result2 = FuzzySearch.search(items, "mange")
      assert "Manage Settings" in result2

      # "change" with typo
      result3 = FuzzySearch.search(items, "chage")
      assert "Change Password" in result3
    end

    test "maintains backward compatibility with threshold parameter" do
      items = ["test", "toast", "taste", "totally_different"]

      # Using threshold as third parameter should still work
      result_strict = FuzzySearch.search(items, "tst", 0.9)
      result_lenient = FuzzySearch.search(items, "tst", 0.5)

      assert is_list(result_strict)
      assert is_list(result_lenient)
      assert length(result_lenient) >= length(result_strict)
    end

    test "complex data structures with typos" do
      items = [
        %{name: "User Profile", description: "Configure user preferences"},
        %{name: "System Settings", description: "Configure system options"},
        %{name: "Profile Settings", description: "Update profile information"}
      ]

      # Search for "profile" which should match the first item exactly
      result = FuzzySearch.search(items, "profile", & &1.name)
      assert length(result) == 2
      assert "User Profile" in Enum.map(result, & &1.name)

      # Search with typo "profle" (missing 'i') should still match "Profile"
      result2 = FuzzySearch.search(items, "profle", & &1.name)
      assert length(result2) == 2
    end

    test "fuzzy matching works at word level for multi-word text" do
      items = [
        "User Profile",
        "Profile Settings",
        "System Configuration",
        "Help Documentation"
      ]

      # Test typo in first word should match "User Profile"
      result1 = FuzzySearch.search(items, "usr")
      assert result1 == ["User Profile"]

      # Test typo in second word should match both items containing "profile"
      result2 = FuzzySearch.search(items, "profle")
      assert result2 == ["User Profile", "Profile Settings"]

      # Test typo should match single word in middle of phrase
      result3 = FuzzySearch.search(items, "documntation")
      assert result3 == ["Help Documentation", "System Configuration"]
    end

    test "scores word matches higher than full text matches" do
      items = ["Purchases", "Change app language"]
      result = FuzzySearch.search(items, "chanhe")
      assert result == ["Change app language", "Purchases"]
    end
  end
end
