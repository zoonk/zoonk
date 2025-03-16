defmodule Zoonk.Queries.UserToken do
  @moduledoc """
  Handles queries for `Zoonk.Schemas.UserToken`.

  This module provides query builders for retrieving, verifying,
  and managing user tokens, including tokens for sessions,
  magic links, and email changes.
  """
  import Ecto.Query

  alias Zoonk.Configuration
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserToken

  @doc """
  Returns the token struct for the given token value and context.
  """
  def by_token_and_context(token, context) do
    where(UserToken, [t], t.token == ^token and t.context == ^context)
  end

  @doc """
  Gets all tokens for the given user identity for the given contexts.
  """
  def by_user_and_contexts(%UserIdentity{} = user_identity, :all) do
    where(UserToken, [t], t.user_identity_id == ^user_identity.id)
  end

  def by_user_and_contexts(%UserIdentity{} = user_identity, contexts) when is_list(contexts) do
    where(UserToken, [t], t.user_identity_id == ^user_identity.id and t.context in ^contexts)
  end

  @doc """
  Deletes a list of tokens.
  """
  def delete_all(tokens) do
    where(UserToken, [t], t.id in ^Enum.map(tokens, & &1.id))
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  The query returns the user identity found by the token, if any.

  The token is valid if it matches the value in the database and it has
  not expired (after @session_validity_in_days).
  """
  def verify_session_token(token) do
    session_validity_in_days = Zoonk.Configuration.get_max_age(:token, :days)

    query =
      token
      |> by_token_and_context("session")
      |> join(:inner, [token], user_identity in assoc(token, :user_identity))
      |> where([token], token.inserted_at > ago(^session_validity_in_days, "day"))
      |> select([token, user_identity], %{user_identity | authenticated_at: token.inserted_at})

    {:ok, query}
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  If found, the query returns a tuple of the form `{user_identity, token}`.

  The given token is valid if it matches its hashed counterpart in the
  database. This function also checks if the token is being used within
  15 minutes. The context of a magic link token is always "login".
  """
  def verify_magic_link_token(token) do
    case Base.url_decode64(token, padding: false) do
      {:ok, decoded_token} ->
        hashed_token = :crypto.hash(Configuration.get_hash_algorithm(), decoded_token)

        query =
          hashed_token
          |> by_token_and_context("login")
          |> join(:inner, [token], user_identity in assoc(token, :user_identity))
          |> where([token], token.inserted_at > ago(^Configuration.get_max_age(:magic_link, :minutes), "minute"))
          |> where([token, user_identity], token.sent_to == user_identity.identity_id)
          |> select([token, user_identity], {user_identity, token})

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  The query returns the user_token found by the token, if any.

  This is used to validate requests to change the user email.
  The given token is valid if it matches its hashed counterpart
  in the database and if it has not expired.

  The context must always start with "change:".
  """
  def verify_change_email_token(token, "change:" <> _rest = context) do
    case Base.url_decode64(token, padding: false) do
      {:ok, decoded_token} ->
        hashed_token = :crypto.hash(Configuration.get_hash_algorithm(), decoded_token)

        query =
          hashed_token
          |> by_token_and_context(context)
          |> where([token], token.inserted_at > ago(^Configuration.get_max_age(:change_email, :days), "day"))

        {:ok, query}

      :error ->
        :error
    end
  end
end
