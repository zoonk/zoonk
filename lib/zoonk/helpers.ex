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
    |> String.trim_trailing("Live")
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

  @doc """
  Decodes a URL-safe Base64 encoded token and applies a function to the decoded result.

  This helper is useful for handling encoded tokens in authentication flows,
  particularly for session tokens that need to be decoded before use.

  ## Parameters

  - `token` - The Base64 URL-encoded token string
  - `fun` - A function to apply to the successfully decoded token
  - `error_value` - The value to return on decoding error (default: `:error`)

  ## Returns

  - The result of applying `fun` to the decoded token if decoding is successful
  - `error_value` if the token cannot be decoded

  ## Examples

      iex> with_decoded_token("c29tZV90b2tlbg==", &String.upcase/1)
      "SOME_TOKEN"

      iex> with_decoded_token("invalid+token", &String.upcase/1)
      :error

      iex> with_decoded_token("invalid+token", &String.upcase/1, nil)
      nil
  """
  def with_decoded_token(token, fun, error_value \\ :error)

  def with_decoded_token(token, fun, error_value) when is_binary(token) and is_function(fun, 1) do
    token
    |> Base.url_decode64(padding: false)
    |> with_decoded_token(fun, error_value)
  end

  def with_decoded_token({:ok, decoded_token}, fun, _error_value), do: fun.(decoded_token)
  def with_decoded_token(_error, _fun, error_value), do: error_value

  @doc """
  Converts a string to an existing atom.

  Returns `nil` if the atom doesn't exist instead of raising an error.

  ## Examples

      iex> to_existing_atom("catalog")
      :catalog

      iex> to_existing_atom("non_existent_atom")
      nil

      iex> to_existing_atom(nil)
      nil
  """
  def to_existing_atom(nil), do: nil

  def to_existing_atom(string) when is_binary(string) do
    String.to_existing_atom(string)
  rescue
    ArgumentError -> nil
  end
end
