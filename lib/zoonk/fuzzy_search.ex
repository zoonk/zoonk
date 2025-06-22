defmodule Zoonk.FuzzySearch do
  @moduledoc """
  Provides fuzzy search functionality using Jaro distance algorithm.

  This module allows searching through collections of items with approximate
  string matching, useful for implementing search features with typo tolerance.
  """

  @doc """
  Performs a fuzzy search on a list of items.

  Returns items that match the query based on the String.jaro_distance/2 algorithm.
  The function accepts a threshold parameter (between 0 and 1) to control how strict
  the matching should be, with higher values requiring closer matches.

  ## Parameters

  - `items` - List of items to search through
  - `query` - The search query string
  - `match_fn` - Function that returns the text to match against for each item (optional, defaults to identity function)
  - `threshold` - Minimum Jaro distance score required for a match (default: 0.75)

  ## Examples

      # Search through a list of strings (using default identity function)
      iex> FuzzySearch.search(["Settings", "Profile", "Help"], "sett")
      ["Settings"]

      # Search through a list of strings (with explicit identity function)
      iex> FuzzySearch.search(["Settings", "Profile", "Help"], "sett", & &1)
      ["Settings"]

      # Search through a list of maps
      iex> FuzzySearch.search([%{name: "Getting Started"}, %{name: "Profile"}], "start", & &1.name)
      [%{name: "Getting Started"}]

      # Using a different threshold
      iex> FuzzySearch.search(["test", "toast", "taste"], "tst", 0.8)
      ["test"]
  """
  def search(items, query, match_fn \\ & &1, threshold \\ 0.75)

  def search(items, nil, _match_fn, _threshold), do: items
  def search(items, "", _match_fn, _threshold), do: items

  # Handle case where the third argument is a number (threshold) instead of a function
  def search(items, query, threshold, _ignored_threshold) when is_binary(query) and is_number(threshold) do
    search(items, query, & &1, threshold)
  end

  def search(items, query, match_fn, threshold) when is_binary(query) and is_function(match_fn, 1) do
    query = String.downcase(query)

    Enum.filter(items, fn item ->
      item_text =
        item
        |> match_fn.()
        |> String.downcase()

      # Check if the item contains the query as a substring (exact match)
      # Or use Jaro distance for fuzzy matching
      String.contains?(item_text, query) or
        String.jaro_distance(item_text, query) >= threshold
    end)
  end
end
