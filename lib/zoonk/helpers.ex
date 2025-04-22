defmodule Zoonk.Helpers do
  @moduledoc """
  Provides helper functions for the Zoonk application.
  """

  @doc """
  Gets the context from a module name.

  The context is the module name that comes after `Zoonk` or `ZoonkWeb`.

  This is useful for some permission checks we make based on module names.
  For example, `:org` and `:editor` contexts require admin permissions,
  while a `:catalog` requires `:member` permissions for private organizations
  but they are not required for public organizations.

  ## Examples

      iex> get_context_from_module(ZoonkWeb.Catalog.CatalogHomeLive)
      :catalog

      iex> get_context_from_module(ZoonkWeb.Org.OrgHomeLive)
      :org

      iex> get_context_from_module(Zoonk.Accounts.User)
      :accounts

      iex> get_context_from_module("ZoonkWeb.Catalog.CatalogHomeLive")
      :catalog
  """
  def get_context_from_module(module) when is_atom(module) do
    module
    |> Module.split()
    |> get_context_from_module()
  end

  def get_context_from_module(module) when is_binary(module) do
    module
    |> String.split(".")
    |> get_context_from_module()
  end

  def get_context_from_module(["Zoonk", scope | _rest]), do: scope_to_atom(scope)
  def get_context_from_module(["ZoonkWeb", scope | _rest]), do: scope_to_atom(scope)
  def get_context_from_module(_module), do: nil

  defp scope_to_atom(scope) do
    scope
    |> String.downcase()
    |> String.to_existing_atom()
  rescue
    ArgumentError -> nil
  end

  @doc """
  Converts a string into snake case.

  ## Examples

      iex> Helpers.to_snake_case("Hello World")
      "hello_world"

      iex> Helpers.to_snake_case("HelloWorld")
      "hello_world"

      iex> Helpers.to_snake_case("Hello World!")
      "hello_world"

      iex> Helpers.to_snake_case("Hello")
      "hello"
  """
  def to_snake_case(string) do
    string
    |> String.replace(~r/([a-z])([A-Z])/, "\\1_\\2")
    |> String.replace(~r/\W+/, "_")
    |> String.downcase()
    |> String.trim_trailing("_")
  end

  @doc """
  Retrieves a changeset from a transaction result.

  ## Examples

      iex> get_changeset_from_transaction({:ok, %{user: user}}, :user)
      {:ok, %User{}}

      iex> get_changeset_from_transaction({:error, :user, changeset, _}, :user)
      {:error, %Ecto.Changeset{}}
  """
  def get_changeset_from_transaction({:ok, response}, key), do: {:ok, response[key]}
  def get_changeset_from_transaction({:error, key, changeset, _error}, key), do: {:error, changeset}

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
      iex> fuzzy_search(["Settings", "Profile", "Help"], "sett")
      ["Settings"]

      # Search through a list of strings (with explicit identity function)
      iex> fuzzy_search(["Settings", "Profile", "Help"], "sett", & &1)
      ["Settings"]

      # Search through a list of maps
      iex> fuzzy_search([%{name: "Getting Started"}, %{name: "Profile"}], "start", & &1.name)
      [%{name: "Getting Started"}]

      # Using a different threshold
      iex> fuzzy_search(["test", "toast", "taste"], "tst", 0.8)
      ["test"]
  """
  def fuzzy_search(items, query, match_fn \\ & &1, threshold \\ 0.75)

  def fuzzy_search(items, nil, _match_fn, _threshold), do: items
  def fuzzy_search(items, "", _match_fn, _threshold), do: items

  # Handle case where the third argument is a number (threshold) instead of a function
  def fuzzy_search(items, query, threshold, _ignored_threshold) when is_binary(query) and is_number(threshold) do
    fuzzy_search(items, query, & &1, threshold)
  end

  def fuzzy_search(items, query, match_fn, threshold) when is_binary(query) and is_function(match_fn, 1) do
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

  @doc """
  Remove accents from a string.

  ## Examples

      iex> remove_accents("Café")
      "Cafe"

      iex> remove_accents("Crème brûlée")
      "Creme brulee"

      iex> remove_accents("naïve")
      "naive"
  """
  def remove_accents(string) do
    string
    |> String.normalize(:nfd)
    |> String.replace(~r/\p{Mn}/u, "")
    |> String.replace(~r/[^a-zA-Z0-9\s]/u, "")
  end
end
