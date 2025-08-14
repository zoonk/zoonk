defmodule Zoonk.Helpers do
  @moduledoc """
  Provides helper functions for the Zoonk application.
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
  def to_existing_atom(value, default \\ nil)

  def to_existing_atom(nil, default), do: default
  def to_existing_atom(atom, _default) when is_atom(atom), do: atom

  def to_existing_atom(string, default) when is_binary(string) do
    String.to_existing_atom(string)
  rescue
    ArgumentError -> default
  end

  @doc """
  Converts a string to a lowercase existing atom.

  Returns `nil` if the atom doesn't exist instead of raising an error.

  ## Examples

      iex> to_lowercase_existing_atom("CATALOG")
      :catalog

      iex> to_lowercase_existing_atom("non_existent_atom")
      nil
  """
  def to_lowercase_existing_atom(string) when is_binary(string) do
    string
    |> String.downcase()
    |> to_existing_atom()
  end

  def to_lowercase_existing_atom(non_binary), do: to_existing_atom(non_binary)

  @doc """
  Conditionally puts a key-value pair into a map.

  Returns the map unchanged if the value is `nil` or an empty string.
  Otherwise, adds the key-value pair to the map.

  ## Examples

      iex> maybe_put(%{}, "key", "value")
      %{"key" => "value"}

      iex> maybe_put(%{"existing" => "data"}, "key", "value")
      %{"existing" => "data", "key" => "value"}

      iex> maybe_put(%{}, "key", nil)
      %{}

      iex> maybe_put(%{}, "key", "")
      %{}
  """
  def maybe_put(map, _key, nil), do: map
  def maybe_put(map, _key, ""), do: map
  def maybe_put(map, key, value), do: Map.put(map, key, value)
end
