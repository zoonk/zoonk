defmodule Zoonk.Helpers do
  @moduledoc """
  Provides helper functions for the Zoonk application.
  """

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
  Normalize all keys in a map to use atoms.

  ## Examples

      iex> Helpers.normalize_keys(%{"hello" => "world"})
      %{hello: "world"}

      iex> Helpers.normalize_keys(%{hello: "world"})
      %{hello: "world"}

      iex> Helpers.normalize_keys(%{"Hello World" => "test"})
      %{hello_world: "test"}
  """
  def normalize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {normalize_key(k), v} end)
  end

  defp normalize_key(key) when is_atom(key), do: key

  defp normalize_key(key) when is_binary(key) do
    key
    |> String.replace(~r/\s+/, "_")
    |> String.downcase()
    |> String.to_existing_atom()
  end
end
