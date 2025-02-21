defmodule Zoonk.Helpers.EctoUtils do
  @moduledoc """
  Provides utility functions for Ecto operations.
  """

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
