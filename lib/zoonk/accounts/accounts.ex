defmodule Zoonk.Accounts do
  @moduledoc """
  Manages user accounts.

  This module handles core account management flows including user signup,
  session management, and email verification.

  It coordinates with the database layer to manage user records and tokens,
  while enforcing security measures like sudo mode and token expiration.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Accounts.TokenBuilder
  alias Zoonk.Accounts.UserNotifier
  alias Zoonk.Accounts.UserProfileBuilder
  alias Zoonk.Configuration
  alias Zoonk.Helpers
  alias Zoonk.Queries
  alias Zoonk.Repo
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserToken

  ## Database getters

  @doc """
  Gets a user by email.

  ## Examples

      iex> get_user_by_email("foo@example.com")
      %User{}

      iex> get_user_by_email("unknown@example.com")
      nil

  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  ## User signup

  @doc """
  Signs up a user.

  ## Examples

      iex> signup_user(%{field: value})
      {:ok, %User{}}

      iex> signup_user(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def signup_user(attrs) do
    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, User.settings_changeset(%User{}, attrs))
    |> Ecto.Multi.insert(:profile, &UserProfileBuilder.build_initial_user_profile/1)
    |> Repo.transaction()
    |> Helpers.EctoUtils.get_changeset_from_transaction(:user)
  end

  ## Settings

  @doc """
  Checks whether the user is in sudo mode.

  The user is in sudo mode when the last authentication was done recently.
  """
  def sudo_mode?(%User{authenticated_at: ts}) when is_struct(ts, DateTime) do
    minutes = Configuration.get_max_age(:sudo_mode, :minutes)
    DateTime.after?(ts, DateTime.add(DateTime.utc_now(), minutes, :minute))
  end

  def sudo_mode?(_user), do: false

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user email.

  See `Zoonk.Schemas.User.email_changeset/3` for a list of supported options.

  ## Examples

      iex> change_user_email(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user_email(user, attrs \\ %{}, opts \\ []) do
    User.email_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user email using the given token.

  If the token matches, the user email is updated and the token is deleted.
  """
  def update_user_email(user, token) do
    context = "change:#{user.email}"

    with {:ok, query} <- Queries.UserToken.verify_change_email_token(token, context),
         %UserToken{sent_to: email} <- Repo.one(query),
         {:ok, _res} <-
           user
           |> user_email_multi(email, context)
           |> Repo.transaction() do
      :ok
    else
      _error -> :error
    end
  end

  defp user_email_multi(user, email, context) do
    changeset = User.email_changeset(user, %{email: email})

    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, changeset)
    |> Ecto.Multi.delete_all(:tokens, Queries.UserToken.by_user_and_contexts(user, [context]))
  end

  ## Session

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user) do
    {token, user_token} = TokenBuilder.build_session_token(user)
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user with the given signed token.
  """
  def get_user_by_session_token(token) do
    {:ok, query} = Queries.UserToken.verify_session_token(token)

    query
    |> Repo.one()
    |> Repo.preload(:profile)
  end

  @doc """
  Gets the user with the given magic link token.
  """
  def get_user_by_magic_link_token(token) do
    with {:ok, query} <- Queries.UserToken.verify_magic_link_token(token),
         {user, _token} <- Repo.one(query) do
      user
    else
      _error -> nil
    end
  end

  @doc """
  Logs the user in by magic link.

  There are three cases to consider:

  1. The user has already confirmed their email. They are logged in
     and the magic link is expired.

  2. The user has not confirmed their email.
     In this case, the user gets confirmed, logged in, and all tokens -
     including session ones - are expired. In theory, no other tokens
     exist but we delete all of them for best security practices.
  """
  def login_user_by_magic_link(token) do
    {:ok, query} = Queries.UserToken.verify_magic_link_token(token)

    case Repo.one(query) do
      {%User{confirmed_at: nil} = user, _token} ->
        user
        |> User.confirm_changeset()
        |> update_user_and_delete_all_tokens()

      {user, token} ->
        Repo.delete!(token)
        {:ok, user, []}

      nil ->
        {:error, :not_found}
    end
  end

  @doc ~S"""
  Delivers the update email instructions to the given user.

  ## Examples

      iex> deliver_user_update_email_instructions(user, current_email, &url(~p"/user/email/confirm/#{&1}"))
      {:ok, %{to: ..., body: ...}}

  """
  def deliver_user_update_email_instructions(%User{} = user, current_email, update_email_url_fun)
      when is_function(update_email_url_fun, 1) do
    {encoded_token, user_token} = TokenBuilder.build_email_token(user, "change:#{current_email}")

    Repo.insert!(user_token)
    UserNotifier.deliver_update_email_instructions(user, update_email_url_fun.(encoded_token))
  end

  @doc ~S"""
  Delivers the magic link login instructions to the given user.
  """
  def deliver_login_instructions(%User{} = user, magic_link_url_fun) when is_function(magic_link_url_fun, 1) do
    {encoded_token, user_token} = TokenBuilder.build_email_token(user, "login")
    Repo.insert!(user_token)
    UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(encoded_token))
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(token) do
    token
    |> Queries.UserToken.by_token_and_context("session")
    |> Repo.delete_all()

    :ok
  end

  ## Token helper

  defp update_user_and_delete_all_tokens(changeset) do
    %{data: %User{} = user} = changeset

    with {:ok, %{user: user, tokens_to_expire: expired_tokens}} <-
           Ecto.Multi.new()
           |> Ecto.Multi.update(:user, changeset)
           |> Ecto.Multi.all(:tokens_to_expire, Queries.UserToken.by_user_and_contexts(user, :all))
           |> Ecto.Multi.delete_all(:tokens, fn %{tokens_to_expire: tokens_to_expire} ->
             Queries.UserToken.delete_all(tokens_to_expire)
           end)
           |> Repo.transaction() do
      {:ok, user, expired_tokens}
    end
  end

  @doc """
  Signs in a user with a third-party account.

  It either links the account to an existing user
  or signs up a new user and links the external identity.

  ## Examples

      iex> login_with_external_account(%{}, "en")
      {:ok, %User{}}

      iex> login_with_external_account(nil, "en")
      {:error, %Ecto.Changeset{}}
  """
  def login_with_external_account(auth, language) do
    user = get_user_by_email(auth["email"])

    case login_with_external_account(auth, language, user) do
      {:ok, %User{} = new_user} -> {:ok, new_user}
      {:ok, %UserIdentity{}} -> {:ok, user}
      {:error, changeset} -> {:error, changeset}
    end
  end

  # Create a new user if it doesn't exist
  defp login_with_external_account(auth, language, nil) do
    signup_user_with_external_account(auth, language)
  end

  # If the user exists, then link the external account
  defp login_with_external_account(auth, _lang, %User{} = user) do
    %{user: user}
    |> user_identity_changeset(get_identity_attrs(auth))
    |> Repo.insert(on_conflict: :nothing)
  end

  # Create a new user and link the external account
  defp signup_user_with_external_account(auth, language) do
    user_attrs = %{email: auth["email"], language: language}
    identity_attrs = get_identity_attrs(auth)
    profile_opts = [display_name: auth["name"], picture_url: auth["picture"], username: auth["preferred_username"]]

    user_changeset =
      %User{}
      |> User.settings_changeset(user_attrs)
      |> User.confirm_changeset()

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, user_changeset)
    |> Ecto.Multi.insert(:profile, &UserProfileBuilder.build_initial_user_profile(&1, profile_opts))
    |> Ecto.Multi.insert(:identity, &user_identity_changeset(&1, identity_attrs))
    |> Repo.transaction()
    |> Helpers.EctoUtils.get_changeset_from_transaction(:user)
  end

  defp user_identity_changeset(%{user: %User{} = user}, identity_attrs) do
    UserIdentity.changeset(%UserIdentity{user_id: user.id}, identity_attrs)
  end

  defp get_identity_attrs(auth) do
    %{identity: auth["provider"], identity_id: to_string(auth["sub"])}
  end
end
