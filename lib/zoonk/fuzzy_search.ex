defmodule Zoonk.FuzzySearch do
  @moduledoc """
  Provides fuzzy search functionality using Jaro distance algorithm.

  This module allows searching through collections of items with approximate
  string matching, useful for implementing search features with typo tolerance.
  """

  @doc """
  Performs a fuzzy search on a list of items with a simple two-step approach.

  The search works in two phases:
  1. First, attempts exact substring matching (case-insensitive)
  2. If no exact matches are found, falls back to fuzzy matching using Jaro distance

  This approach prioritizes precision - exact matches are always preferred over fuzzy matches,
  eliminating false positives while still providing typo tolerance when needed.

  The fuzzy matching algorithm checks both the full text and individual words within the text,
  making it effective at handling typos in multi-word scenarios.

  ## Parameters

  - `items` - List of items to search through
  - `query` - The search query string
  - `match_fn` - Function that returns the text to match against for each item (optional, defaults to identity function)
  - `threshold` - Minimum Jaro distance score required for fuzzy matches (default: 0.75, lowered to 0.6 for better typo detection)

  ## Examples

      # Exact substring matching (case-insensitive)
      iex> FuzzySearch.search(["Settings", "Profile", "Help"], "sett")
      ["Settings"]

      # Fuzzy matching kicks in only when no exact matches exist
      iex> FuzzySearch.search(["profile", "project"], "profle")
      ["profile"]

      # Fuzzy matching works with multi-word text by checking individual words
      iex> FuzzySearch.search(["User Profile", "Profile Settings"], "profle")
      ["User Profile", "Profile Settings"]

      # Search through complex data structures
      iex> FuzzySearch.search([%{name: "Getting Started"}, %{name: "Profile"}], "start", & &1.name)
      [%{name: "Getting Started"}]

      # Multiple exact matches are returned
      iex> FuzzySearch.search(["Settings", "Set Password"], "set")
      ["Settings", "Set Password"]
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
    exact_matches = find_exact_matches(items, query, match_fn)

    case exact_matches do
      [] -> find_fuzzy_matches(items, query, match_fn, threshold)
      matches -> matches
    end
  end

  defp find_exact_matches(items, query, match_fn) do
    Enum.filter(items, fn item ->
      item_text = get_item_text(item, match_fn)
      String.contains?(item_text, query)
    end)
  end

  defp find_fuzzy_matches(items, query, match_fn, threshold) do
    items
    |> Enum.map(&score_item(&1, query, match_fn, threshold))
    |> Enum.filter(fn {_item, score} -> score > 0 end)
    |> Enum.sort_by(fn {_item, score} -> -score end)
    |> Enum.map(fn {item, _score} -> item end)
  end

  defp score_item(item, query, match_fn, threshold) do
    item_text = get_item_text(item, match_fn)
    score = fuzzy_match_score(item_text, query, threshold)
    {item, score}
  end

  defp get_item_text(item, match_fn) do
    item
    |> match_fn.()
    |> String.downcase()
  end

  # Enhanced fuzzy matching using Jaro distance
  # Checks both the full text and individual words within the text
  defp fuzzy_match_score(item_text, query, threshold) do
    adjusted_threshold = calculate_adjusted_threshold(threshold)
    full_text_score = String.jaro_distance(item_text, query)

    if full_text_score >= adjusted_threshold do
      full_text_score
    else
      score_individual_words(item_text, query, adjusted_threshold)
    end
  end

  defp calculate_adjusted_threshold(threshold), do: max(threshold - 0.1, 0.6)

  defp score_individual_words(item_text, query, adjusted_threshold) do
    item_text
    |> String.split(~r/\s+/, trim: true)
    |> Enum.map(&String.jaro_distance(&1, query))
    |> Enum.filter(&(&1 >= adjusted_threshold))
    |> case do
      [] -> 0
      distances -> Enum.max(distances)
    end
  end
end
