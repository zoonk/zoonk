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
  Retrieves a changeset from a transaction result.

  ## Examples

      iex> get_changeset_from_transaction({:ok, %{user: user}}, :user)
      {:ok, %User{}}

      iex> get_changeset_from_transaction({:error, :user, changeset, _}, :user)
      {:error, %Ecto.Changeset{}}
  """
  def get_changeset_from_transaction({:ok, response}, key), do: {:ok, response[key]}
  def get_changeset_from_transaction({:error, key, changeset, _error}, key), do: {:error, changeset}
end
